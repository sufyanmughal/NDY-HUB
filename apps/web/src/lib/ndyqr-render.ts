import QRCode from "qrcode";
import jsQR from "jsqr";

/**
 * NDYQR™ brand renderer — the single place the NDY visual identity for QR
 * codes is implemented, so no product has to reproduce it (client's explicit
 * requirement: "branding handled centrally by NDYQR™, so individual products
 * don't each implement their own QR design").
 *
 * The standard it enforces:
 *   - Pink → purple → blue NDY gradient (magenta #e600f0 → violet #a855f7 →
 *     sky #38bdf8), matching the Passport card's brand gradient exactly.
 *   - Rounded modules *and* rounded finder patterns (the three corner squares).
 *   - White background with a proper quiet zone.
 *   - The official ND logo permanently centered — and, crucially, the center
 *     area is *reserved* (those modules are omitted) rather than the logo being
 *     pasted over the code afterwards, so the code stays scannable.
 *   - High error correction (level H, ~30% recovery) to absorb the reserved
 *     center and real-world print/screen wear.
 *   - PNG (canvas) and SVG output.
 *
 * The gradient/error-correction/quiet-zone/logo-ratio choices here ARE the
 * standard; callers only choose an optional tint (colorFrom/colorTo) and target
 * size. Everything else stays consistent so any NDY QR is instantly
 * recognizable.
 */

export const NDY_QR_BRAND = {
  // Printed-safe DEPTH, not the full display palette. The original display
  // values (#e600f0 → #a855f7 → #38bdf8) render beautifully and DO NOT SCAN —
  // the light sky stop has too little luminance contrast against white for a
  // reader to binarize. Verified by the API renderer's decode test
  // (apps/api/src/ndyqr/ndyqr-render.service.spec.ts); keep the two in sync.
  colorFrom: "#c026d3", // magenta
  colorMid: "#7c3aed", // violet
  colorTo: "#1d4ed8", // blue
  background: "#ffffff",
  logoPath: "/logo-mark.png",
} as const;

export interface NdyQrRenderOptions {
  /** Target output size in pixels (PNG) / viewBox units (SVG). */
  sizePx?: number;
  /** Any of the brand gradient stops may be overridden; omitted stops fall
   * back to the NDY standard so a code never loses its identity. */
  colorFrom?: string | null;
  colorTo?: string | null;
  /** Data URL for the centered logo. Omit to fall back to the official
   * /logo-mark.png loaded by the page, or (if that fails) a drawn "ND" mark. */
  logoDataUrl?: string | null;
  /** Fraction of the code width reserved for the center logo. Kept modest so
   * the omitted modules stay well inside level-H error correction. */
  logoRatio?: number;
  /** Quiet-zone width in modules (spec minimum is 4). */
  marginModules?: number;
}

interface QrMatrix {
  size: number;
  isDark: (row: number, col: number) => boolean;
}

function buildMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const size = qr.modules.size;
  return {
    size,
    // modules.get(row, col) -> 1 for a dark module, 0 for light (the
    // @types/qrcode BitMatrix signature types it as number, not boolean).
    isDark: (row, col) => qr.modules.get(row, col) !== 0,
  };
}

/** Reserves the center square (in module units). Slightly rounded down to an
 * even span so it stays visually centered on the module grid. */
function centerReserve(size: number, logoRatio: number): {
  start: number;
  end: number;
  span: number;
} {
  const span = Math.max(4, Math.round(size * logoRatio));
  const start = Math.floor((size - span) / 2);
  return { start, end: start + span - 1, span };
}

function inFinder(row: number, col: number, size: number): boolean {
  const inTopLeft = row < 7 && col < 7;
  const inTopRight = row < 7 && col >= size - 7;
  const inBottomLeft = row >= size - 7 && col < 7;
  return inTopLeft || inTopRight || inBottomLeft;
}

function inCenter(
  row: number,
  col: number,
  reserve: { start: number; end: number },
): boolean {
  return (
    row >= reserve.start &&
    row <= reserve.end &&
    col >= reserve.start &&
    col <= reserve.end
  );
}

/** Renders the branded QR to a canvas and returns a PNG data URL. Client-only
 * (needs `document`/Canvas) — always called from a "use client" page or an
 * onClick handler. */
export async function renderNdyQrPng(
  text: string,
  options: NdyQrRenderOptions = {},
): Promise<string> {
  const sizePx = options.sizePx ?? 1024;
  const margin = options.marginModules ?? 4;
  const logoRatio = options.logoRatio ?? 0.24;
  const colorFrom = options.colorFrom ?? NDY_QR_BRAND.colorFrom;
  const colorTo = options.colorTo ?? NDY_QR_BRAND.colorTo;

  const matrix = buildMatrix(text);
  const reserve = centerReserve(matrix.size, logoRatio);
  const totalModules = matrix.size + margin * 2;
  const moduleSize = sizePx / totalModules;

  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  // Background + quiet zone.
  ctx.fillStyle = NDY_QR_BRAND.background;
  ctx.fillRect(0, 0, sizePx, sizePx);

  // Diagonal NDY gradient across the code area.
  const gradient = ctx.createLinearGradient(0, 0, sizePx, sizePx);
  gradient.addColorStop(0, colorFrom);
  gradient.addColorStop(0.5, NDY_QR_BRAND.colorMid);
  gradient.addColorStop(1, colorTo);
  ctx.fillStyle = gradient;

  const px = (m: number) => (m + margin) * moduleSize;

  // Data modules: rounded squares with a small gap (the "dot" look).
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.isDark(row, col)) continue;
      if (inFinder(row, col, matrix.size)) continue; // drawn separately below
      if (inCenter(row, col, reserve)) continue; // reserved for the logo
      // Edge-to-edge (no gap) with a corner radius — inset "dots" break the
      // module grid and were verified NOT to decode; rounding carries the
      // style safely.
      roundRect(ctx, px(col), px(row), moduleSize, moduleSize, moduleSize * 0.28);
      ctx.fill();
    }
  }

  // Finder patterns: rounded outer ring + rounded inner block, so the three
  // corner markers carry the same rounded language while staying scannable.
  drawFinder(ctx, px(0), px(0), moduleSize);
  drawFinder(ctx, px(matrix.size - 7), px(0), moduleSize);
  drawFinder(ctx, px(0), px(matrix.size - 7), moduleSize);

  // Center logo, drawn inside the reserved (module-free) zone.
  const reservePx = px(reserve.start);
  const reserveSizePx = reserve.span * moduleSize;
  const logoPadding = reserveSizePx * 0.12;
  ctx.fillStyle = NDY_QR_BRAND.background;
  roundRect(
    ctx,
    reservePx - logoPadding,
    reservePx - logoPadding,
    reserveSizePx + logoPadding * 2,
    reserveSizePx + logoPadding * 2,
    reserveSizePx * 0.28,
  );
  ctx.fill();

  const logoDataUrl =
    options.logoDataUrl !== undefined
      ? options.logoDataUrl
      : await loadImageDataUrl(NDY_QR_BRAND.logoPath).catch(() => null);

  if (logoDataUrl) {
    const img = await loadImage(logoDataUrl);
    const logoSize = reserveSizePx;
    const aspect = img.width / img.height || 1;
    const drawW = aspect >= 1 ? logoSize : logoSize * aspect;
    const drawH = aspect >= 1 ? logoSize / aspect : logoSize;
    ctx.drawImage(
      img,
      reservePx + (reserveSizePx - drawW) / 2,
      reservePx + (reserveSizePx - drawH) / 2,
      drawW,
      drawH,
    );
  } else {
    drawNdMonogram(ctx, reservePx, reserveSizePx, colorFrom, colorTo);
  }

  return canvas.toDataURL("image/png");
}

/** Vector version of the same code, for print/large format (client asked for
 * SVG as well as PNG). */
export function renderNdyQrSvg(
  text: string,
  options: NdyQrRenderOptions = {},
): string {
  const sizePx = options.sizePx ?? 1024;
  const margin = options.marginModules ?? 4;
  const logoRatio = options.logoRatio ?? 0.24;
  const colorFrom = options.colorFrom ?? NDY_QR_BRAND.colorFrom;
  const colorTo = options.colorTo ?? NDY_QR_BRAND.colorTo;

  const matrix = buildMatrix(text);
  const reserve = centerReserve(matrix.size, logoRatio);
  const total = matrix.size + margin * 2;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}" shape-rendering="geometricPrecision">`,
  );
  parts.push(
    `<defs><linearGradient id="ndyqr-grad" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0%" stop-color="${colorFrom}"/>` +
      `<stop offset="50%" stop-color="${NDY_QR_BRAND.colorMid}"/>` +
      `<stop offset="100%" stop-color="${colorTo}"/>` +
      `</linearGradient></defs>`,
  );
  parts.push(
    `<rect width="${total}" height="${total}" fill="${NDY_QR_BRAND.background}"/>`,
  );

  // Edge-to-edge modules with a corner radius (see the PNG path's comment).
  const r = 0.28;
  const g = "fill=\"url(#ndyqr-grad)\"";

  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.isDark(row, col)) continue;
      if (inFinder(row, col, matrix.size)) continue;
      if (inCenter(row, col, reserve)) continue;
      parts.push(
        `<rect x="${margin + col}" y="${margin + row}" width="1" height="1" rx="${r}" ${g}/>`,
      );
    }
  }

  // Finder patterns in local coordinates (drawn with the same nested-rect
  // approach as the canvas version).
  for (const [fx, fy] of [
    [0, 0],
    [matrix.size - 7, 0],
    [0, matrix.size - 7],
  ]) {
    const x = margin + fx;
    const y = margin + fy;
    parts.push(
      `<rect x="${x}" y="${y}" width="7" height="7" rx="1.6" ${g}/>`,
      `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="1.15" fill="${NDY_QR_BRAND.background}"/>`,
      `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.7" ${g}/>`,
    );
  }

  // Reserved center + drawn ND monogram (kept vector — no raster logo embed,
  // so the SVG stays self-contained and print-crisp).
  const cx = margin + reserve.start;
  const span = reserve.span;
  parts.push(
    `<rect x="${cx - span * 0.12}" y="${cx - span * 0.12}" width="${span * 1.24}" height="${span * 1.24}" rx="${span * 0.28}" fill="${NDY_QR_BRAND.background}"/>`,
    `<text x="${cx + span / 2}" y="${cx + span / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${span * 0.62}" fill="url(#ndyqr-grad)">ND</text>`,
  );

  parts.push("</svg>");
  return parts.join("");
}

// --- drawing helpers -------------------------------------------------------

function drawFinder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  moduleSize: number,
): void {
  const outer = moduleSize * 7;
  roundRect(ctx, x, y, outer, outer, outer * 0.24);
  ctx.fill();

  const inner1 = moduleSize;
  ctx.save();
  ctx.fillStyle = NDY_QR_BRAND.background;
  roundRect(ctx, x + inner1, y + inner1, outer - inner1 * 2, outer - inner1 * 2, outer * 0.16);
  ctx.fill();
  ctx.restore();

  const inner2 = moduleSize * 2;
  roundRect(ctx, x + inner2, y + inner2, outer - inner2 * 2, outer - inner2 * 2, outer * 0.1);
  ctx.fill();
}

function drawNdMonogram(
  ctx: CanvasRenderingContext2D,
  x: number,
  size: number,
  colorFrom: string,
  colorTo: string,
): void {
  const grad = ctx.createLinearGradient(x, x, x + size, x + size);
  grad.addColorStop(0, colorFrom);
  grad.addColorStop(1, colorTo);
  ctx.fillStyle = grad;
  ctx.font = `900 ${size * 0.62}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ND", x + size / 2, x + size / 2);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

async function loadImageDataUrl(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Triggers a browser download of a data/blob URL — same small helper shape
 * used by the passport PDF download. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Automatic readability validation (the client's explicit "automatic
 * scan/readability validation before a QR is published" requirement).
 *
 * Renders the PNG back through a real QR decoder and confirms it decodes to
 * exactly the expected text. This is the safety net that catches the one
 * failure mode that would most undermine the brand — a beautiful code that
 * doesn't scan (e.g. a tint with too little contrast, or a logo ratio that
 * overran the error-correction budget). Callers should refuse to publish/
 * download when this returns false rather than handing back an unscannable
 * image.
 */
export async function validateNdyQrPng(
  pngDataUrl: string,
  expectedText: string,
): Promise<boolean> {
  try {
    const img = await loadImage(pngDataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
    const decoded = jsQR(data, width, height);
    return decoded?.data === expectedText;
  } catch {
    return false;
  }
}
