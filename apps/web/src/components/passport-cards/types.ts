/** Shared shape every card design renders from — a flattened, presentation-
 * ready view over MeProfile/PublicPassport so the designs don't each
 * reimplement "which name/photo/verified fallback to show." */
export interface PassportCardData {
  ndyId: string;
  displayName: string;
  profilePhotoUrl: string | null | undefined;
  verified: boolean;
  bio: string | null | undefined;
  country: string | null | undefined;
  website: string | null | undefined;
  linkedinUrl: string | null | undefined;
  instagramUrl: string | null | undefined;
  xUrl: string | null | undefined;
  businessName: string | null | undefined;
  businessRole: string | null | undefined;
  email: string | null | undefined;
  /** e.g. "Legacy" / "Founder" — the current membership tier label, shown
   * in the Passport design's bottom-left badge (matching the mockup's
   * "VERIFIED MEMBER / LEGACY" badge). Self-view only: the public
   * /passport/[ndyId] page has no endpoint exposing a stranger's paid
   * tier, so this stays undefined there and the badge falls back to
   * "NDY HUB" as its second line instead of a tier name. */
  membershipTierLabel: string | null | undefined;
  qrDataUrl: string | null;
}

export type PassportCardDesignId = "passport" | "business" | "minimal";

export interface PassportCardDesign {
  id: PassportCardDesignId;
  label: string;
  description: string;
}

export const PASSPORT_CARD_DESIGNS: PassportCardDesign[] = [
  {
    id: "passport",
    label: "NDY Passport",
    description: "Vertical identity card — photo, NDY ID, and QR front and center.",
  },
  {
    id: "business",
    label: "Business Card",
    description: "Horizontal layout for sharing contact and business details.",
  },
  {
    id: "minimal",
    label: "Minimal Dark",
    description: "A stripped-back, high-contrast card for a cleaner look.",
  },
];
