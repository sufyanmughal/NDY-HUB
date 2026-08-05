import { VerticalPassportCard } from "./vertical-card";
import { BusinessPassportCard } from "./business-card";
import { MinimalPassportCard } from "./minimal-card";
import type { PassportCardData, PassportCardDesignId } from "./types";

export * from "./types";

const REGISTRY: Record<
  PassportCardDesignId,
  (props: { data: PassportCardData }) => React.JSX.Element
> = {
  passport: VerticalPassportCard,
  business: BusinessPassportCard,
  minimal: MinimalPassportCard,
};

export function PassportCard({
  design,
  data,
}: {
  design: PassportCardDesignId;
  data: PassportCardData;
}) {
  const Card = REGISTRY[design] ?? VerticalPassportCard;
  return <Card data={data} />;
}
