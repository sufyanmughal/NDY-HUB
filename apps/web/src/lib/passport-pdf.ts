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

// The Passport design's own palette — matches
// components/passport-cards/vertical-card.tsx exactly (the NDJOYIT brand
// gradient: magenta/violet/cyan against a near-black card), not this
// app's blue/purple COLORS.accent/accent2. Kept separate since the
// Business Card and Minimal designs below still use the app-wide palette.
const PASSPORT_COLORS = {
  cardBg: "#010a19",
  magenta: "#e600f0",
  violet: "#a855f7",
  sky: "#38bdf8",
  indigo: "#818cf8", // footer badge gradient's second stop, matches the on-screen card
  slateMuted: "#94a3b8",
  slateBody: "#f1f5f9",
  bio: "#f0abfc",
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
  /** Same self-view-only treatment as email. */
  phone?: string | null;
  /** Data: URL versions of public/logo-mark.png and public/verified-badge.png
   * — the actual brand assets, not hand-drawn approximations. Populated by
   * downloadPassportPdf below (fetched once, same static files the
   * on-screen card's <Image> tags point at) rather than required from
   * every caller; buildPassportPdf/buildPassportCardPdf degrade to a text
   * wordmark / no badge if either fetch failed, same "don't fail the
   * whole download over a missing extra" precedent as photoDataUrl. */
  logoDataUrl?: string | null;
  verifiedBadgeDataUrl?: string | null;
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
// "Passport" design — matches components/passport-cards/vertical-card.tsx
// exactly (which itself matches the user's passportcard.jpeg reference):
// full "ND / NDJOYIT / HUB" logo lockup + "PASSPORT / DIGITAL BUSINESS
// CARD" heading + NFC glyph in the header; photo (with the real
// verified-badge.png overlay, not a hand-drawn checkmark) + name/title/
// bio in a left column, a vertical divider, then icon-led contact rows
// (NDY ID/Location/Email/Website/Phone) in a right column; a footer row
// pairing a "Verified Member / <tier>" badge with a QR + "Scan to
// connect" caption. PASSPORT_COLORS mirrors that component's NDJOYIT
// magenta/violet/cyan palette.
// ============================================================

const PAGE_WIDTH = 460;
const PAGE_HEIGHT = 660;
const MARGIN = 28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function buildPassportCardPdf(data: PassportPdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: [PAGE_WIDTH, PAGE_HEIGHT] });

  doc.setFillColor(PASSPORT_COLORS.cardBg);
  doc.roundedRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 20, 20, "F");

  // Header: logo lockup (left) + "PASSPORT / DIGITAL BUSINESS CARD" (center) + NFC glyph (right)
  const headerTop = MARGIN;
  const logoHeight = 54;
  if (data.logoDataUrl) {
    // public/logo-mark.png is 547x457 — preserve that aspect ratio.
    const logoWidth = logoHeight * (547 / 457);
    doc.addImage(data.logoDataUrl, "PNG", MARGIN, headerTop, logoWidth, logoHeight);
  } else {
    // Falls back to a plain text wordmark if the asset fetch failed —
    // matches the on-screen card's own graceful-degradation precedent
    // for a missing photo, just for the logo instead.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor("#ffffff");
    doc.text("NDJOYIT HUB", MARGIN, headerTop + logoHeight / 2);
  }

  const headingX = MARGIN + 130;
  let y = headerTop + 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor("#ffffff");
  doc.text("PASSPORT", headingX, y);
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(PASSPORT_COLORS.violet);
  doc.text("DIGITAL BUSINESS", headingX, y);
  const dbWidth = doc.getTextWidth("DIGITAL BUSINESS ");
  doc.setTextColor(PASSPORT_COLORS.sky);
  doc.text("CARD", headingX + dbWidth, y);

  drawNfcGlyph(doc, PAGE_WIDTH - MARGIN - 10, headerTop + 10);

  // Body: photo/name/bio column (left) | vertical divider | icon rows column (right)
  const bodyTop = headerTop + logoHeight + 30;
  const avatarR = 28;
  const avatarCx = MARGIN + avatarR;
  const avatarCy = bodyTop + avatarR;
  drawAvatar(doc, data, avatarCx, avatarCy, avatarR, 20);
  if (data.verified) {
    const badgeR = 10;
    const badgeCx = avatarCx + avatarR - 2;
    const badgeCy = avatarCy + avatarR - 2;
    if (data.verifiedBadgeDataUrl) {
      doc.addImage(
        data.verifiedBadgeDataUrl,
        "PNG",
        badgeCx - badgeR,
        badgeCy - badgeR,
        badgeR * 2,
        badgeR * 2,
      );
    } else {
      doc.setFillColor("#2b8fff");
      doc.circle(badgeCx, badgeCy, badgeR, "F");
      doc.setTextColor("#ffffff");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      centerText(doc, "✓", badgeCx, badgeCy + 3);
    }
  }

  const dividerX = MARGIN + CONTENT_WIDTH * 0.46;
  const leftColWidth = dividerX - MARGIN - 14;
  let leftY = avatarCy + avatarR + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor("#ffffff");
  doc.text(truncateToWidth(doc, data.fullName, leftColWidth), MARGIN, leftY);

  const titleLine = [data.businessRole, data.businessName].filter(Boolean).join(" | ");
  if (titleLine) {
    leftY += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(PASSPORT_COLORS.slateMuted);
    doc.text(truncateToWidth(doc, titleLine, leftColWidth), MARGIN, leftY);
  }
  if (data.bio) {
    leftY += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(PASSPORT_COLORS.bio);
    const bioLines = doc.splitTextToSize(data.bio, leftColWidth) as string[];
    doc.text(bioLines.slice(0, 3), MARGIN, leftY);
    leftY += bioLines.slice(0, 3).length * 11;
  }

  // Right column: icon-led label/value rows
  const rightColX = dividerX + 14;
  const rightColWidth = PAGE_WIDTH - MARGIN - rightColX;
  const infoRows: ["id" | "location" | "email" | "website" | "phone", string, string][] = [
    ["id", "NDY ID", data.ndyId],
    ...(data.country ? [["location", "Location", data.country] as ["location", string, string]] : []),
    ...(data.email ? [["email", "Email", data.email] as ["email", string, string]] : []),
    ...(data.website
      ? [["website", "Website", data.website.replace(/^https?:\/\//, "")] as ["website", string, string]]
      : []),
    ...(data.phone ? [["phone", "Phone", data.phone] as ["phone", string, string]] : []),
  ];
  let rowY = bodyTop + 4;
  for (const [kind, label, value] of infoRows) {
    drawInfoIcon(doc, kind, rightColX + 8, rowY + 6, PASSPORT_COLORS.violet);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(PASSPORT_COLORS.slateMuted);
    doc.text(label.toUpperCase(), rightColX + 22, rowY + 2);

    doc.setFont(label === "NDY ID" ? "courier" : "helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(PASSPORT_COLORS.slateBody);
    doc.text(truncateToWidth(doc, value, rightColWidth - 22), rightColX + 22, rowY + 15);

    rowY += 30;
  }

  // Vertical divider between the two body columns
  const dividerBottom = Math.max(leftY, rowY - 12);
  doc.setDrawColor("#ffffff");
  doc.setGState(new GState({ opacity: 0.1 }));
  doc.setLineWidth(1);
  doc.line(dividerX, bodyTop, dividerX, dividerBottom);
  doc.setGState(new GState({ opacity: 1 }));

  const bodyBottom = dividerBottom + 18;

  // Footer: badge (left) + QR with center ND badge (right)
  const qrSize = 78;
  const qrX = PAGE_WIDTH - MARGIN - qrSize;
  const footerTop = bodyBottom;
  const badgeWidth = qrX - MARGIN - 16;

  doc.setDrawColor(PASSPORT_COLORS.violet);
  doc.setGState(new GState({ opacity: 0.35 }));
  doc.setLineWidth(1);
  doc.roundedRect(MARGIN, footerTop, badgeWidth, qrSize, 14, 14, "D");
  doc.setGState(new GState({ opacity: 1 }));

  const badgeLabel = data.verified ? "VERIFIED MEMBER" : "NOT VERIFIED";
  const badgeValue = data.membershipTierLabel ?? "NDY HUB";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(PASSPORT_COLORS.slateMuted);
  doc.text(badgeLabel, MARGIN + 14, footerTop + 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(PASSPORT_COLORS.indigo);
  doc.text(truncateToWidth(doc, badgeValue, badgeWidth - 28), MARGIN + 14, footerTop + 44);

  doc.setFillColor("#ffffff");
  doc.roundedRect(qrX - 6, footerTop, qrSize + 12, qrSize + 12, 10, 10, "F");
  doc.addImage(data.qrDataUrl, "PNG", qrX, footerTop + 6, qrSize, qrSize);
  // center "ND" badge overlay, matching the on-screen card
  const centerBadgeR = 13;
  const centerBadgeCx = qrX + qrSize / 2;
  const centerBadgeCy = footerTop + 6 + qrSize / 2;
  doc.setFillColor("#0b1220");
  doc.circle(centerBadgeCx, centerBadgeCy, centerBadgeR, "F");
  doc.setDrawColor("#ffffff");
  doc.setLineWidth(1.5);
  doc.circle(centerBadgeCx, centerBadgeCy, centerBadgeR, "D");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(PASSPORT_COLORS.violet);
  centerText(doc, "ND", centerBadgeCx, centerBadgeCy + 2.8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(PASSPORT_COLORS.slateMuted);
  centerText(doc, "Scan to connect", qrX + qrSize / 2, footerTop + qrSize + 26);

  drawFooter(doc, MARGIN, PAGE_HEIGHT - 20);

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

/** Small hand-drawn glyphs for the Passport design's icon-led info rows —
 * jsPDF has no SVG/icon-font support, so these are simple vector
 * approximations of the on-screen Lucide icons (Fingerprint/MapPin/Mail/
 * Globe) rather than the real glyphs, just enough to read as "an icon" at
 * this size rather than leaving the tinted square empty. cx/cy is the
 * icon's own center. */
function drawInfoIcon(
  doc: jsPDF,
  kind: "id" | "location" | "email" | "website" | "phone",
  cx: number,
  cy: number,
  color: string = COLORS.accent2,
): void {
  doc.setDrawColor(color);
  doc.setFillColor(color);
  doc.setLineWidth(0.9);

  if (kind === "id") {
    // ID-card stand-in: rounded rect with a small dot (IdCard glyph)
    doc.roundedRect(cx - 5, cy - 3.5, 10, 7, 1.2, 1.2, "D");
    doc.circle(cx - 2, cy, 1, "F");
    doc.line(cx + 0.5, cy - 1, cx + 3.5, cy - 1);
    doc.line(cx + 0.5, cy + 1, cx + 3.5, cy + 1);
  } else if (kind === "location") {
    // pin stand-in: circle over a downward point
    doc.circle(cx, cy - 1, 3, "D");
    doc.triangle(cx - 2.4, cy + 0.6, cx + 2.4, cy + 0.6, cx, cy + 4.6, "F");
  } else if (kind === "email") {
    // envelope stand-in: rect + open flap lines
    doc.roundedRect(cx - 5, cy - 3.5, 10, 7, 1, 1, "D");
    doc.line(cx - 4.5, cy - 3, cx, cy + 0.5);
    doc.line(cx, cy + 0.5, cx + 4.5, cy - 3);
  } else if (kind === "phone") {
    // handset stand-in: rounded rect rotated via two overlapping shapes
    doc.roundedRect(cx - 3.5, cy - 5, 7, 10, 3, 3, "D");
  } else {
    // globe stand-in: circle + horizontal/vertical meridian lines
    doc.circle(cx, cy, 4.2, "D");
    doc.line(cx - 4.2, cy, cx + 4.2, cy);
    doc.ellipse(cx, cy, 1.8, 4.2, "D");
  }
}

/** Rotated Wifi/NFC glyph stand-in (three concentric arcs), matching the
 * reference component's `<Wifi className="rotate-90" />` in the top-right
 * corner of the header. cx/cy is the glyph's own anchor point (top-right
 * of its bounding box, same as where the reference visually sits). */
function drawNfcGlyph(doc: jsPDF, cx: number, cy: number): void {
  doc.setDrawColor("#ffffff");
  doc.setGState(new GState({ opacity: 0.9 }));
  doc.setLineWidth(1.1);
  doc.circle(cx, cy, 3, "D");
  doc.circle(cx, cy, 6.5, "D");
  doc.circle(cx, cy, 10, "D");
  doc.setGState(new GState({ opacity: 1 }));
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
 * the PDF is still worth having without a photo. Also fetches the two
 * static brand assets (logo-mark.png, verified-badge.png) as data URLs —
 * only actually used by the "passport" design, but cheap/harmless to fetch
 * regardless of which design was requested, and each degrades to a plain
 * fallback (text wordmark / hand-drawn checkmark) on its own if it fails,
 * same as the photo.
 */
export async function downloadPassportPdf(
  data: Omit<PassportPdfData, "photoDataUrl"> & { photoUrl?: string | null },
  design: PassportPdfDesign = "passport",
): Promise<void> {
  const { photoUrl, ...rest } = data;
  const [photoDataUrl, logoDataUrl, verifiedBadgeDataUrl] = await Promise.all([
    photoUrl ? loadSquarePhotoDataUrl(photoUrl, 256).catch(() => null) : Promise.resolve(null),
    loadImageDataUrl("/logo-mark.png").catch(() => null),
    loadImageDataUrl("/verified-badge.png").catch(() => null),
  ]);
  const doc = buildPassportPdf({ ...rest, photoDataUrl, logoDataUrl, verifiedBadgeDataUrl }, design);
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

/** Fetches a same-origin static asset (public/…) and returns it as a
 * data: URL — jsPDF's addImage happily takes a data: URL but not a plain
 * path, and unlike the user's photo this never needs cropping/resizing,
 * just the raw bytes re-encoded. */
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
