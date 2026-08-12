// Typed data shapes for the NDY Economy page's components. NDYBITS and
// CRYNDY are NOT mock — they're built from useNdybitsSummary()/
// useCryndySummary() (real ledger/purchase data already wired up
// elsewhere in this app) inside page.tsx and passed down as this same
// shape. NDYX is the one genuinely mocked/placeholder value here: no
// backend model exists for it yet (see docs/ndy-economy-implementation-
// plan.md, Phase 2 — gated behind allocation sign-off and eventually
// legal review), so it's held at a fixed 0 rather than fabricated.
// TODO: replace NDYX's placeholder values once its backend model exists.

export interface AssetBalance {
  symbol: "NDYBITS" | "CRYNDY" | "NDYX";
  name: string;
  amount: number;
  euroValue: number;
  colorHex: string;
}

export interface Transaction {
  id: string;
  symbol: AssetBalance["symbol"];
  amount: number; // signed
  description: string;
  timestamp: string; // ISO
}

export interface ProgressionData {
  symbol: AssetBalance["symbol"];
  label: string;
  current: number;
  target: number;
  percent: number; // can exceed 100
}

// Reference values from the client's NDY Economy specification — internal
// planning/display constants only, never presented as a guaranteed market
// price (see docs/ndy-economy-implementation-plan.md's legal gate).
export const NDYBITS_REF_VALUE_EUR = 0.25;
export const CRYNDY_REF_VALUE_EUR = 2.5;
export const NDYX_REF_VALUE_EUR = 250;
export const NDYBITS_PER_CRYNDY = 10;
export const CRYNDY_PER_NDYX = 100;

export const ASSET_COLORS: Record<AssetBalance["symbol"], string> = {
  NDYBITS: "#f6b503",
  CRYNDY: "#3ecf6a",
  NDYX: "#7e34e9",
};
