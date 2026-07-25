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
  good: "#22c58b",
  critical: "#f0605a",
};

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
}

const PAGE_WIDTH = 400;
const PAGE_HEIGHT = 720;
const MARGIN = 32;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CENTER_X = PAGE_WIDTH / 2;

// Fixed offsets from the card's top edge — computed once, top to bottom, so
// the panel height (drawn first, as the card's background) and every
// element inside it (drawn after) agree on the same numbers instead of one
// being inferred from where the other happened to land.
const CARD_PAD_TOP = 36;
const AVATAR_R = 32;
const QR_SIZE = 130;
const NAME_Y = CARD_PAD_TOP + AVATAR_R * 2 + 16;
const LABEL_Y = NAME_Y + 20;
const ID_Y = LABEL_Y + 14;
const QR_TOP = ID_Y + 20;
const PILL_TOP = QR_TOP + QR_SIZE + 20;
const PILL_HEIGHT = 22;
const CARD_HEIGHT = PILL_TOP + PILL_HEIGHT + 24;

const DETAIL_ROW_HEIGHT = 26;

/**
 * Builds the passport PDF in memory — pure, no DOM or download side
 * effects, so it works from the browser (downloadPassportPdf below) and
 * from a plain Node script for testing alike.
 */
export function buildPassportPdf(data: PassportPdfData): jsPDF {
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

  // Avatar (initials only — no external photo fetch in the PDF path, see
  // the page component for why real profilePhotoUrls only render on screen)
  const avatarCenterY = cardTop + CARD_PAD_TOP + AVATAR_R;
  doc.setFillColor(COLORS.accent);
  doc.circle(CENTER_X, avatarCenterY, AVATAR_R, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor("#ffffff");
  const initial = (data.fullName.trim().charAt(0) || "N").toUpperCase();
  centerText(doc, initial, CENTER_X, avatarCenterY + 8);

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(COLORS.foreground);
  centerText(doc, truncateToWidth(doc, data.fullName, CONTENT_WIDTH - 32), CENTER_X, cardTop + NAME_Y);

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
  doc.addImage(data.qrDataUrl, "PNG", CENTER_X - QR_SIZE / 2, cardTop + QR_TOP, QR_SIZE, QR_SIZE);

  // Status pill — filled at low opacity behind the text, the same visual
  // idea as the app's `bg-good/15 text-good` badges, done with jsPDF's
  // GState opacity support since there's no CSS alpha-channel shorthand here.
  const statusColor = data.verified ? COLORS.good : COLORS.critical;
  const statusText = data.verified ? "VERIFIED" : "NOT VERIFIED";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const statusWidth = doc.getTextWidth(statusText);
  const pillWidth = statusWidth + 28;
  const pillX = CENTER_X - pillWidth / 2;
  const pillY = cardTop + PILL_TOP;

  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.15 }));
  doc.setFillColor(statusColor);
  doc.roundedRect(pillX, pillY, pillWidth, PILL_HEIGHT, PILL_HEIGHT / 2, PILL_HEIGHT / 2, "F");
  doc.restoreGraphicsState();

  doc.setTextColor(statusColor);
  centerText(doc, statusText, CENTER_X, pillY + PILL_HEIGHT / 2 + 3);

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

  // Footer
  const footerY = rowY + 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COLORS.foregroundMuted);
  doc.text(
    `Generated ${new Date().toLocaleDateString()} — this is a system-generated document, not a legal identity document.`,
    MARGIN,
    footerY,
  );

  return doc;
}

/** Browser-only: builds the PDF and triggers a file download. */
export function downloadPassportPdf(data: PassportPdfData): void {
  const doc = buildPassportPdf(data);
  doc.save(`ndy-passport-${data.ndyId}.pdf`);
}

function centerText(doc: jsPDF, text: string, centerX: number, y: number): void {
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
