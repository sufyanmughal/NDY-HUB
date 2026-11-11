import { VerticalPassportCard } from "./vertical-card";
import { BusinessPassportCard } from "./business-card";
import { MinimalPassportCard } from "./minimal-card";
import type { PassportCardData, PassportCardDesignId } from "./types";

export * from "./types";
export { VerticalPassportCard } from "./vertical-card";

/** Only the Business and Minimal designs own a "Download PDF" button
 * directly (per the 2026-11 redesign, each now renders it in its own
 * layout position instead of a generic header button shared by all three —
 * see business-card.tsx / minimal-card.tsx doc comments). The Passport
 * design keeps its download button in the page-level header above the
 * card, so it ignores these props entirely. */
export interface PassportCardExtraProps {
  onDownloadPdf?: () => void;
  downloadLabel?: string;
  downloadDisabled?: boolean;
}

export function PassportCard({
  design,
  data,
  ...extra
}: {
  design: PassportCardDesignId;
  data: PassportCardData;
} & PassportCardExtraProps) {
  if (design === "business") return <BusinessPassportCard data={data} {...extra} />;
  if (design === "minimal") return <MinimalPassportCard data={data} {...extra} />;
  return <VerticalPassportCard data={data} />;
}
