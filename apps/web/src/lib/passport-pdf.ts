import { jsPDF, GState } from "jspdf";

// Same hex values as globals.css — duplicated rather than imported because
// jsPDF draws on a canvas-like model with no access to CSS custom
// properties; this is the one place in the app that has to know the theme
// colors as literal values instead of Tailwind classes.
const COLORS = {
  background: "#0a0d16",
  surface: "#10141f",
  border: "#232a3d",
  foreground: "#eef1f8",
  foregroundMuted: "#8891a8",
  accent: "#4f7cff",
  accent2: "#8b5cf6",
  good: "#22c58b",
  critical: "#f0605a",
};

/** Which on-screen card design (components/passport-cards/) the PDF
 * should match — kept as a plain string union rather than importing
 * PassportCardDesignId from components/passport-cards/types.ts, since
 * that file assumes a browser/React environment and this module is also
 * usable from a plain Node script (see the module doc comment below). */
export type PassportPdfDesign = "passport" | "business" | "minimal";

export interface PassportPdfData {
  ndyId: string;
  fullName: string;
  verified: boolean;
  verificationLevelLabel: string; // e.g. "Level 1" — already formatted by the caller
  membershipLabel: string;
  cryndyBalanceLabel: string;
  ndybitsBalanceLabel: string;
  connectedPlatformsLabel: string;
  /** A data: URL PNG, generated the same way as the on-screen QR (same
   * `qrcode` package) — reused here rather than re-rendered, so the QR in
   * the PDF is guaranteed to match what's on screen. */
  qrDataUrl: string;
  /** A square-cropped data: URL, produced by loadSquarePhotoDataUrl below.
   * Optional/nullable — falls back to the initials avatar when absent
   * (no photo set, or the fetch/crop failed for any reason). */
  photoDataUrl?: string | null;
  // --- Business Card design fields — all optional; that design's layout
  // simply omits a row when the field is absent, same as the on-screen
  // BusinessPassportCard. Unused by the "passport"/"minimal" designs. ---
  bio?: string | null;
  country?: string | null;
  website?: string | null;
  businessName?: string | null;
  businessRole?: string | null;
}

/**
 * Builds the passport PDF in memory — pure, no DOM or download side
 * effects, so it works from the browser (downloadPassportPdf below) and
 * from a plain Node script for testing alike. Dispatches to one of three
 * layout builders below, matching the three on-screen card designs
 * (components/passport-cards/vertical-card.tsx, business-card.tsx,
 * minimal-card.tsx) so "Download PDF" always produces whichever design
 * is currently selected on screen instead of always the original layout.
 */
export function buildPassportPdf(
  data: PassportPdfData,
  design: PassportPdfDesign = "passport",
): jsPDF {
  if (design === "business") return buildBusinessCardPdf(data);
  if (design === "minimal") return buildMinimalCardPdf(data);
  return buildPassportCardPdf(data);
}

// ============================================================
// "NDY Passport" design — the original vertical layout.
// ============================================================

const PAGE_WIDTH = 400;
const PAGE_HEIGHT = 760;
const MARGIN = 32;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CENTER_X = PAGE_WIDTH / 2;

// Fixed offsets from the card's top edge — computed once, top to bottom, so
// the panel height (drawn first, as the card's background) and every
// element inside it (drawn after) agree on the same numbers instead of one
// being inferred from where the other happened to land.
const CARD_PAD_TOP = 36;
const AVATAR_R = 40;
const QR_SIZE = 130;
const NAME_Y = CARD_PAD_TOP + AVATAR_R * 2 + 16;
const LABEL_Y = NAME_Y + 20;
const ID_Y = LABEL_Y + 14;
const QR_TOP = ID_Y + 20;
const PILL_TOP = QR_TOP + QR_SIZE + 20;
const PILL_HEIGHT = 22;
const CARD_HEIGHT = PILL_TOP + PILL_HEIGHT + 24;

const DETAIL_ROW_HEIGHT = 26;

function buildPassportCardPdf(data: PassportPdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: [PAGE_WIDTH, PAGE_HEIGHT] });

  doc.setFillColor(COLORS.background);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  // Header wordmark
  let y = 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(COLORS.foreground);
  doc.text("NDY ", MARGIN, y);
  const ndyWidth = doc.getTextWidth("NDY ");
  doc.setTextColor(COLORS.accent);
  doc.text("HUB", MARGIN + ndyWidth, y);

  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(COLORS.foregroundMuted);
  doc.text("One Identity. One Passport. One Ecosystem.", MARGIN, y);

  // Card panel background
  const cardTop = y + 24;
  doc.setFillColor(COLORS.surface);
  doc.setDrawColor(COLORS.border);
  doc.setLineWidth(1);
  doc.roundedRect(MARGIN, cardTop, CONTENT_WIDTH, CARD_HEIGHT, 12, 12, "FD");

  // "NDY PASSPORT" card label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COLORS.foregroundMuted);
  doc.text("NDY PASSPORT", MARGIN + 16, cardTop + 18);

  // Avatar — the real photo, circle-clipped, when one loaded successfully;
  // otherwise the same gradient-initial fallback the on-screen Avatar
  // component uses.
  const avatarCenterY = cardTop + CARD_PAD_TOP + AVATAR_R;
  drawAvatar(doc, data, CENTER_X, avatarCenterY, AVATAR_R, 26);

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(COLORS.foreground);
  centerText(
    doc,
    truncateToWidth(doc, data.fullName, CONTENT_WIDTH - 32),
    CENTER_X,
    cardTop + NAME_Y,
  );

  // NDY ID label + value
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLORS.foregroundMuted);
  centerText(doc, "NDY ID", CENTER_X, cardTop + LABEL_Y);

  doc.setFont("courier", "normal");
  doc.setFontSize(12);
  doc.setTextColor(COLORS.foreground);
  centerText(doc, data.ndyId, CENTER_X, cardTop + ID_Y);

  // QR code
  doc.addImage(
    data.qrDataUrl,
    "PNG",
    CENTER_X - QR_SIZE / 2,
    cardTop + QR_TOP,
    QR_SIZE,
    QR_SIZE,
  );

  // Status pill
  drawStatusPill(doc, data.verified, CENTER_X, cardTop + PILL_TOP, PILL_HEIGHT);

  // Passport details
  const detailsTop = cardTop + CARD_HEIGHT + 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLORS.foregroundMuted);
  doc.text("PASSPORT DETAILS", MARGIN, detailsTop);

  const rows: [string, string][] = [
    ["Membership", data.membershipLabel],
    ["CRYNDY Holdings", data.cryndyBalanceLabel],
    ["NDYBITS", data.ndybitsBalanceLabel],
    ["Connected Platforms", data.connectedPlatformsLabel],
    ["Verification Level", data.verificationLevelLabel],
  ];

  let rowY = detailsTop + 22;
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(COLORS.foregroundMuted);
    doc.text(label, MARGIN, rowY);

    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.setTextColor(COLORS.foreground);
    const valueText = truncateToWidth(doc, value, CONTENT_WIDTH * 0.55);
    const valueWidth = doc.getTextWidth(valueText);
    doc.text(valueText, PAGE_WIDTH - MARGIN - valueWidth, rowY);

    doc.setDrawColor(COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, rowY + 8, PAGE_WIDTH - MARGIN, rowY + 8);

    rowY += DETAIL_ROW_HEIGHT;
  }

  drawFooter(doc, MARGIN, rowY + 20);

  return doc;
}

// ============================================================
// "Business Card" design — horizontal layout matching
// components/passport-cards/business-card.tsx: photo+name+role on the
// left, contact rows below, QR top-right.
// ============================================================

const BIZ_WIDTH = 620;
const BIZ_HEIGHT = 360;
const BIZ_MARGIN = 34;

function buildBusinessCardPdf(data: PassportPdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: [BIZ_WIDTH, BIZ_HEIGHT] });

  doc.setFillColor(COLORS.background);
  doc.rect(0, 0, BIZ_WIDTH, BIZ_HEIGHT, "F");
  doc.setFillColor(COLORS.surface);
  doc.setDrawColor(COLORS.border);
  doc.setLineWidth(1);
  doc.roundedRect(16, 16, BIZ_WIDTH - 32, BIZ_HEIGHT - 32, 16, 16, "FD");

  const left = BIZ_MARGIN;
  const y = 60;

  // Header wordmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(COLORS.foreground);
  doc.text("NDY ", left, y);
  const ndyWidth = doc.getTextWidth("NDY ");
  doc.setTextColor(COLORS.accent);
  doc.text("HUB", left + ndyWidth, y);

  // Avatar
  const avatarR = 44;
  const avatarCx = left + avatarR;
  const avatarCy = y + 50;
  drawAvatar(doc, data, avatarCx, avatarCy, avatarR, 26);

  // Name + role, right of avatar
  const textX = avatarCx + avatarR + 20;
  const textMaxWidth = BIZ_WIDTH - BIZ_MARGIN - textX;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(COLORS.foreground);
  doc.text(truncateToWidth(doc, data.fullName, textMaxWidth), textX, avatarCy - 6);

  const roleLine = [data.businessRole, data.businessName].filter(Boolean).join(" · ");
  if (roleLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(COLORS.foregroundMuted);
    doc.text(truncateToWidth(doc, roleLine, textMaxWidth), textX, avatarCy + 14);
  }

  drawStatusPill(doc, data.verified, textX + 46, avatarCy + 34, 18, true);

  // Bio
  let contentY = avatarCy + avatarR + 30;
  if (data.bio) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(COLORS.foregroundMuted);
    const bioLines = doc.splitTextToSize(data.bio, BIZ_WIDTH / 2 - BIZ_MARGIN * 1.5) as string[];
    doc.text(bioLines.slice(0, 3), left, contentY);
    contentY += bioLines.slice(0, 3).length * 13 + 8;
  }

  // Contact rows (country / website / membership)
  const contactRows: [string, string][] = [
    ...(data.country ? [["Location", data.country] as [string, string]] : []),
    ...(data.website ? [["Website", data.website] as [string, string]] : []),
    ["Membership", data.membershipLabel],
  ];
  doc.setDrawColor(COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(left, contentY, BIZ_WIDTH / 2 - 10, contentY);
  contentY += 18;
  for (const [label, value] of contactRows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.foregroundMuted);
    doc.text(label.toUpperCase(), left, contentY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(COLORS.foreground);
    doc.text(truncateToWidth(doc, value, BIZ_WIDTH / 2 - BIZ_MARGIN * 1.5), left, contentY + 13);
    contentY += 30;
  }

  // QR + NDY ID, right column
  const qrSize = 120;
  const qrX = BIZ_WIDTH - BIZ_MARGIN - qrSize;
  const qrY = 56;
  doc.setFillColor("#ffffff");
  doc.roundedRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 8, 8, "F");
  doc.addImage(data.qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  doc.setFont("courier", "normal");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.foregroundMuted);
  centerText(doc, data.ndyId, qrX + qrSize / 2, qrY + qrSize + 26);

  drawFooter(doc, left, BIZ_HEIGHT - 24);

  return doc;
}

// ============================================================
// "Minimal Dark" design — matching
// components/passport-cards/minimal-card.tsx: identity + QR only.
// ============================================================

const MIN_WIDTH = 360;
const MIN_HEIGHT = 560;
const MIN_MARGIN = 30;

function buildMinimalCardPdf(data: PassportPdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: [MIN_WIDTH, MIN_HEIGHT] });
  const centerX = MIN_WIDTH / 2;

  doc.setFillColor(COLORS.background);
  doc.rect(0, 0, MIN_WIDTH, MIN_HEIGHT, "F");
  doc.setDrawColor(COLORS.border);
  doc.setLineWidth(1);
  doc.roundedRect(14, 14, MIN_WIDTH - 28, MIN_HEIGHT - 28, 14, 14, "D");

  let y = 56;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(COLORS.foreground);
  doc.text("NDY ", MIN_MARGIN, y);
  const ndyWidth = doc.getTextWidth("NDY ");
  doc.setTextColor(COLORS.accent);
  doc.text("HUB", MIN_MARGIN + ndyWidth, y);

  // Verified dot, top-right
  doc.setFillColor(data.verified ? COLORS.good : COLORS.foregroundMuted);
  doc.circle(MIN_WIDTH - MIN_MARGIN - 5, y - 4, 4, "F");

  y += 60;
  const avatarR = 32;
  drawAvatar(doc, data, MIN_MARGIN + avatarR, y, avatarR, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(COLORS.foreground);
  doc.text(
    truncateToWidth(doc, data.fullName, MIN_WIDTH - MIN_MARGIN - (MIN_MARGIN + avatarR * 2 + 16)),
    MIN_MARGIN + avatarR * 2 + 16,
    y - 4,
  );
  doc.setFont("courier", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(COLORS.foregroundMuted);
  doc.text(data.ndyId, MIN_MARGIN + avatarR * 2 + 16, y + 14);

  // QR, centered
  const qrSize = 190;
  const qrTop = y + 70;
  doc.setFillColor("#ffffff");
  doc.roundedRect(centerX - qrSize / 2 - 8, qrTop - 8, qrSize + 16, qrSize + 16, 10, 10, "F");
  doc.addImage(data.qrDataUrl, "PNG", centerX - qrSize / 2, qrTop, qrSize, qrSize);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(COLORS.foregroundMuted);
  centerText(doc, "ONE IDENTITY. ONE PASSPORT. ONE ECOSYSTEM.", centerX, qrTop + qrSize + 34);

  drawFooter(doc, MIN_MARGIN, MIN_HEIGHT - 26);

  return doc;
}

// ============================================================
// Shared drawing helpers
// ============================================================

function drawAvatar(
  doc: jsPDF,
  data: Pick<PassportPdfData, "photoDataUrl" | "fullName">,
  cx: number,
  cy: number,
  r: number,
  initialFontSize: number,
): void {
  if (data.photoDataUrl) {
    doc.saveGraphicsState();
    doc.ellipse(cx, cy, r, r, null);
    doc.clip();
    doc.discardPath();
    doc.addImage(data.photoDataUrl, "PNG", cx - r, cy - r, r * 2, r * 2);
    doc.restoreGraphicsState();
  } else {
    doc.setFillColor(COLORS.accent);
    doc.circle(cx, cy, r, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(initialFontSize);
    doc.setTextColor("#ffffff");
    const initial = (data.fullName.trim().charAt(0) || "N").toUpperCase();
    centerText(doc, initial, cx, cy + initialFontSize * 0.35);
  }
}

/** Filled at low opacity behind the text, the same visual idea as the
 * app's `bg-good/15 text-good` badges, done with jsPDF's GState opacity
 * support since there's no CSS alpha-channel shorthand here. `leftAlign`
 * draws the pill starting at x instead of centered on it (used by the
 * Business Card design, where the pill sits next to text rather than
 * centered on a column). */
function drawStatusPill(
  doc: jsPDF,
  verified: boolean,
  x: number,
  y: number,
  height: number,
  leftAlign = false,
): void {
  const statusColor = verified ? COLORS.good : COLORS.critical;
  const statusText = verified ? "VERIFIED" : "NOT VERIFIED";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(height >= 20 ? 9 : 7.5);
  const statusWidth = doc.getTextWidth(statusText);
  const pillWidth = statusWidth + (height >= 20 ? 28 : 20);
  const pillX = leftAlign ? x : x - pillWidth / 2;

  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.15 }));
  doc.setFillColor(statusColor);
  doc.roundedRect(pillX, y, pillWidth, height, height / 2, height / 2, "F");
  doc.restoreGraphicsState();

  doc.setTextColor(statusColor);
  if (leftAlign) {
    doc.text(statusText, pillX + pillWidth / 2 - statusWidth / 2, y + height / 2 + 3);
  } else {
    centerText(doc, statusText, x, y + height / 2 + 3);
  }
}

function drawFooter(doc: jsPDF, x: number, y: number): void {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COLORS.foregroundMuted);
  doc.text(
    `Generated ${new Date().toLocaleDateString()} — this is a system-generated document, not a legal identity document.`,
    x,
    y,
  );
}

/**
 * Browser-only: fetches and crops the real photo (if there is one), builds
 * the PDF, and triggers a file download. A failed photo fetch — network
 * error, no photo set, CORS misconfigured in some future environment —
 * degrades to the initials avatar rather than failing the whole download;
 * the PDF is still worth having without a photo.
 */
export async function downloadPassportPdf(
  data: Omit<PassportPdfData, "photoDataUrl"> & { photoUrl?: string | null },
  design: PassportPdfDesign = "passport",
): Promise<void> {
  const { photoUrl, ...rest } = data;
  const photoDataUrl = photoUrl
    ? await loadSquarePhotoDataUrl(photoUrl, 256).catch(() => null)
    : null;
  const doc = buildPassportPdf({ ...rest, photoDataUrl }, design);
  doc.save(`ndy-passport-${design}-${data.ndyId}.pdf`);
}

/**
 * Fetches the photo directly (not via an <img> tag) so the raw bytes are
 * available to redraw into a canvas — reading pixels back out of a
 * cross-origin image requires the server's opt-in via CORS either way,
 * whether that's a fetch() of the bytes or a canvas draw of an <img>.
 * Crops to a square with "cover" scaling — the same behavior the
 * on-screen Avatar gets for free from CSS's object-cover — so a
 * non-square upload doesn't get squashed into an oval by the PDF's
 * circular clip.
 */
async function loadSquarePhotoDataUrl(
  photoUrl: string,
  size: number,
): Promise<string> {
  const res = await fetch(photoUrl);
  if (!res.ok) throw new Error(`Failed to fetch photo: ${res.status}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  ctx.drawImage(
    bitmap,
    (size - drawWidth) / 2,
    (size - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  return canvas.toDataURL("image/png");
}

function centerText(
  doc: jsPDF,
  text: string,
  centerX: number,
  y: number,
): void {
  const width = doc.getTextWidth(text);
  doc.text(text, centerX - width / 2, y);
}

/** jsPDF doesn't wrap text for us in a single `text()` call — for the few
 * fields here that could plausibly overflow (a long name, a long tier
 * label) this trims to fit rather than letting text run past the card
 * edge or overlap the next row. */
function truncateToWidth(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && doc.getTextWidth(`${truncated}…`) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}
