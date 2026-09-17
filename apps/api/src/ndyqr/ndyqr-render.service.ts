import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import jsQR from 'jsqr';
import sharp from 'sharp';

/**
 * Server-side NDYQR™ brand renderer — the Node port of
 * `apps/web/src/lib/ndyqr-render.ts`, for the image endpoints that let
 * non-JS clients (mobile apps, print pipelines) fetch a branded code without
 * running the web renderer.
 *
 * Approach differs from the browser on purpose: there is no `canvas` in Node,
 * so the source of truth here is the SVG (pure string generation), and PNG is
 * produced by rasterising that SVG with `sharp`. That keeps ONE implementation
 * of the brand decisions (gradient, rounded modules/finders, reserved centre
 * zone, Level-H error correction) — the same values as the web renderer — with
 * no canvas dependency and no second drawing code path.
 *
 * Kept in sync with the web renderer by hand (like the session-secret util
 * pair elsewhere in this repo): if the brand standard changes, change both.
 */

/**
 * The scannable NDY gradient. Same magenta → violet → blue identity as the
 * brand palette, but at print-safe DEPTH rather than full display brightness.
 *
 * This is not a style preference — it's a decoding requirement, and it was
 * found by this service's own decode test: the original display values
 * (#e600f0 → #a855f7 → #38bdf8) render beautifully and DO NOT SCAN, because the
 * light sky stop has too little luminance contrast against the white
 * background for a reader to binarize. Darkening the stops keeps the hue
 * progression and the "this is NDY" read while guaranteeing contrast.
 *
 * Keep in sync with apps/web/src/lib/ndyqr-render.ts.
 */
export const NDY_QR_BRAND = {
  colorFrom: '#c026d3', // magenta
  colorMid: '#7c3aed', // violet
  colorTo: '#1d4ed8', // blue
  background: '#ffffff',
} as const;

const DEFAULT_SIZE = 1024;
const DEFAULT_MARGIN_MODULES = 4;
const DEFAULT_LOGO_RATIO = 0.24;

export interface NdyQrRenderOptions {
  sizePx?: number;
  colorFrom?: string | null;
  colorTo?: string | null;
  logoRatio?: number;
  marginModules?: number;
}

interface QrMatrix {
  size: number;
  isDark: (row: number, col: number) => boolean;
}

function buildMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  return {
    size,
    // modules.get(row, col) -> 1 for dark, 0 for light.
    isDark: (row, col) => qr.modules.get(row, col) !== 0,
  };
}

function centerReserve(size: number, logoRatio: number) {
  const span = Math.max(4, Math.round(size * logoRatio));
  const start = Math.floor((size - span) / 2);
  return { start, span };
}

function inFinder(row: number, col: number, size: number): boolean {
  return (
    (row < 7 && col < 7) ||
    (row < 7 && col >= size - 7) ||
    (row >= size - 7 && col < 7)
  );
}

function inCenter(
  row: number,
  col: number,
  reserve: { start: number; span: number },
): boolean {
  const end = reserve.start + reserve.span - 1;
  return row >= reserve.start && row <= end && col >= reserve.start && col <= end;
}

@Injectable()
export class NdyQrRenderService {
  /** The branded code as a self-contained SVG string. Pure — no I/O. */
  renderSvg(text: string, options: NdyQrRenderOptions = {}): string {
    const sizePx = options.sizePx ?? DEFAULT_SIZE;
    const margin = options.marginModules ?? DEFAULT_MARGIN_MODULES;
    const logoRatio = options.logoRatio ?? DEFAULT_LOGO_RATIO;
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

    // Modules are drawn EDGE-TO-EDGE (no gap) with a corner radius. An earlier
    // version inset each module to make a "dot" pattern — verified by the
    // decode test in ndyqr-render.service.spec.ts to be UNREADABLE by a real QR
    // reader, because the gaps break up the module grid a decoder relies on.
    // Rounding the corners alone still gives the rounded/futuristic NDY look
    // while keeping adjacent modules contiguous.
    const radius = 0.28;
    const fill = 'fill="url(#ndyqr-grad)"';

    for (let row = 0; row < matrix.size; row++) {
      for (let col = 0; col < matrix.size; col++) {
        if (!matrix.isDark(row, col)) continue;
        if (inFinder(row, col, matrix.size)) continue;
        if (inCenter(row, col, reserve)) continue;
        parts.push(
          `<rect x="${margin + col}" y="${margin + row}" width="1" height="1" rx="${radius}" ${fill}/>`,
        );
      }
    }

    for (const [fx, fy] of [
      [0, 0],
      [matrix.size - 7, 0],
      [0, matrix.size - 7],
    ]) {
      const x = margin + fx;
      const y = margin + fy;
      parts.push(
        `<rect x="${x}" y="${y}" width="7" height="7" rx="1.6" ${fill}/>`,
        `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="1.15" fill="${NDY_QR_BRAND.background}"/>`,
        `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.7" ${fill}/>`,
      );
    }

    // Reserved centre + the drawn ND mark. (The web renderer draws the same
    // mark for SVG; embedding the raster logo asset server-side is a follow-up.)
    const cx = margin + reserve.start;
    const span = reserve.span;
    parts.push(
      `<rect x="${cx - span * 0.12}" y="${cx - span * 0.12}" width="${span * 1.24}" height="${span * 1.24}" rx="${span * 0.28}" fill="${NDY_QR_BRAND.background}"/>`,
      `<text x="${cx + span / 2}" y="${cx + span / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${span * 0.62}" fill="url(#ndyqr-grad)">ND</text>`,
    );

    parts.push('</svg>');
    return parts.join('');
  }

  /** PNG bytes, rasterised from the same SVG (no canvas). */
  async renderPng(
    text: string,
    options: NdyQrRenderOptions = {},
  ): Promise<Buffer> {
    const svg = this.renderSvg(text, options);
    const sizePx = options.sizePx ?? DEFAULT_SIZE;
    return sharp(Buffer.from(svg), { density: 384 })
      .resize(sizePx, sizePx)
      .png()
      .toBuffer();
  }

  /**
   * Automatic readability validation, server-side — the same guarantee the web
   * renderer gives, so a self-hosted/print client can trust the bytes it gets.
   * Rasterises the PNG to raw RGBA and decodes it with a real QR reader;
   * returns false if it doesn't decode back to exactly `text`.
   */
  async validate(text: string, options: NdyQrRenderOptions = {}): Promise<boolean> {
    const png = await this.renderPng(text, options);
    return (await this.decodePng(png)) === text;
  }

  /** Decodes an already-rendered PNG back to its text, or null if it can't be
   * read. Lets a caller validate the exact buffer it is about to serve rather
   * than rendering a second time. */
  async decodePng(png: Buffer): Promise<string | null> {
    try {
      const { data, info } = await sharp(png)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      return decoded?.data ?? null;
    } catch {
      return null;
    }
  }
}
