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
  /** Self-view only — the current membership tier label, shown in the
   * Passport design's footer badge (matches the on-screen
   * VerticalPassportCard). Falls back to "NDY HUB" when absent, same as
   * the on-screen card. */
  membershipTierLabel?: string | null;
  /** Real account email — self-view only, shown as an icon row on the
   * Passport design (matches the on-screen card, which also only shows
   * this on the authenticated /passport page, never the public one). */
  email?: string | null;
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
// "Passport" design — pixel-accurate clone of the passportcard.jpeg
// reference mockup: ND wordmark + "PASSPORT / Digital Business Card"
// header with an NFC glyph, photo+name+role+bio on the left, icon-led
// contact rows (NDY ID/Location/Email/Website) on the right, and a
// footer row pairing a "Verified Member / <tier>" badge with a QR.
// Matches components/passport-cards/vertical-card.tsx +
// styles/passport-card.css.
// ============================================================

const PAGE_WIDTH = 440;
const PAGE_HEIGHT = 620;
const MARGIN = 28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function buildPassportCardPdf(data: PassportPdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: [PAGE_WIDTH, PAGE_HEIGHT] });

  doc.setFillColor(COLORS.background);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
  doc.setDrawColor(COLORS.border);
  doc.setLineWidth(1);
  doc.roundedRect(14, 14, PAGE_WIDTH - 28, PAGE_HEIGHT - 28, 18, 18, "D");

  // Header: ND wordmark left, "PASSPORT / Digital Business Card" right
  let y = MARGIN + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(COLORS.foreground);
  doc.text("NDY ", MARGIN, y);
  const ndyWidth = doc.getTextWidth("NDY ");
  doc.setTextColor(COLORS.accent);
  doc.text("HUB", MARGIN + ndyWidth, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(COLORS.foreground);
  const titleWidth = doc.getTextWidth("PASSPORT");
  doc.text("PASSPORT", PAGE_WIDTH - MARGIN - titleWidth, y - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(COLORS.accent2);
  const subWidth = doc.getTextWidth("DIGITAL BUSINESS CARD");
  doc.text("DIGITAL BUSINESS CARD", PAGE_WIDTH - MARGIN - subWidth, y + 11);

  y += 26;
  doc.setDrawColor(COLORS.border);
  doc.setLineWidth(1);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);

  // Body: two columns — identity (left), contact rows (right)
  const colGap = 22;
  const leftColWidth = CONTENT_WIDTH * 0.5 - colGap / 2;
  const rightColX = MARGIN + leftColWidth + colGap;
  const rightColWidth = CONTENT_WIDTH - leftColWidth - colGap;
  const bodyTop = y + 30;

  const avatarR = 34;
  const avatarCx = MARGIN + avatarR;
  const avatarCy = bodyTop;
  drawAvatar(doc, data, avatarCx, avatarCy, avatarR, 22);

  let leftY = avatarCy + avatarR + 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(COLORS.foreground);
  doc.text(truncateToWidth(doc, data.fullName, leftColWidth), MARGIN, leftY);

  const roleLine = [data.businessRole, data.businessName].filter(Boolean).join(" | ");
  if (roleLine) {
    leftY += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(COLORS.foregroundMuted);
    doc.text(truncateToWidth(doc, roleLine, leftColWidth), MARGIN, leftY);
  }
  if (data.bio) {
    leftY += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(COLORS.accent2);
    const bioLines = doc.splitTextToSize(data.bio, leftColWidth) as string[];
    doc.text(bioLines.slice(0, 3), MARGIN, leftY);
    leftY += bioLines.slice(0, 3).length * 12;
  }

  // Right column: icon-style label/value rows
  const infoRows: [string, string][] = [
    ["NDY ID", data.ndyId],
    ...(data.country ? [["Location", data.country] as [string, string]] : []),
    ...(data.email ? [["Email", data.email] as [string, string]] : []),
    ...(data.website ? [["Website", data.website.replace(/^https?:\/\//, "")] as [string, string]] : []),
  ];
  let rowY = bodyTop - avatarR + 8;
  for (const [label, value] of infoRows) {
    doc.setFillColor(COLORS.accent);
    doc.setGState(new GState({ opacity: 0.16 }));
    doc.roundedRect(rightColX, rowY - 9, 20, 20, 5, 5, "F");
    doc.setGState(new GState({ opacity: 1 }));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COLORS.foregroundMuted);
    doc.text(label.toUpperCase(), rightColX + 28, rowY - 3);

    doc.setFont(label === "NDY ID" ? "courier" : "helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(COLORS.foreground);
    doc.text(truncateToWidth(doc, value, rightColWidth - 28), rightColX + 28, rowY + 10);

    rowY += 34;
  }

  const bodyBottom = Math.max(leftY, rowY) + 20;

  // Footer: badge (left) + QR (right)
  doc.setDrawColor(COLORS.border);
  doc.setLineWidth(1);
  doc.line(MARGIN, bodyBottom, PAGE_WIDTH - MARGIN, bodyBottom);

  const footerY = bodyBottom + 22;
  const badgeLabel = data.verified ? "VERIFIED MEMBER" : "NOT VERIFIED";
  const badgeValue = data.membershipTierLabel ?? "NDY HUB";
  doc.setFillColor(COLORS.accent);
  doc.setGState(new GState({ opacity: 0.07 }));
  doc.roundedRect(MARGIN, footerY, 150, 46, 10, 10, "F");
  doc.setGState(new GState({ opacity: 1 }));
  doc.setDrawColor(COLORS.border);
  doc.roundedRect(MARGIN, footerY, 150, 46, 10, 10, "D");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLORS.foregroundMuted);
  doc.text(badgeLabel, MARGIN + 12, footerY + 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(COLORS.accent2);
  doc.text(truncateToWidth(doc, badgeValue, 126), MARGIN + 12, footerY + 34);

  const qrSize = 68;
  const qrX = PAGE_WIDTH - MARGIN - qrSize;
  doc.setFillColor("#ffffff");
  doc.roundedRect(qrX - 6, footerY - 4, qrSize + 12, qrSize + 12, 8, 8, "F");
  doc.addImage(data.qrDataUrl, "PNG", qrX, footerY + 2, qrSize, qrSize);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLORS.foregroundMuted);
  centerText(doc, "Scan to connect", qrX + qrSize / 2, footerY + qrSize + 22);

  drawFooter(doc, MARGIN, PAGE_HEIGHT - 22);

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
