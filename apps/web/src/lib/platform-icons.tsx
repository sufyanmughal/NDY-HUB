import {
  Sparkles,
  Coins,
  Rocket,
  Briefcase,
  HelpCircle,
  Flame,
  Building2,
  MapPin,
  Layers,
  Hexagon,
  type LucideIcon,
} from "lucide-react";

// One icon + accent color per platform, matching the client's reference
// mockup's per-tile badges — these are placeholder brand marks (no real
// logo assets exist for the not-yet-built NDJOYIT sub-products), not
// literal logo reproductions.
export const PLATFORM_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  NDJOYIT: { icon: Sparkles, color: "#22C55E" },
  CRYNDY: { icon: Coins, color: "#D946EF" },
  "CRYNDY Presale": { icon: Rocket, color: "#F59E0B" },
  "NDJOYIT Business": { icon: Briefcase, color: "#8B5CF6" },
  NDYQUIZ: { icon: HelpCircle, color: "#3B82F6" },
  NDYXTRA: { icon: Flame, color: "#F97316" },
  NDYSTAYS: { icon: Building2, color: "#EC4899" },
  NDJOYMENTS: { icon: MapPin, color: "#06B6D4" },
  NDYCOLLECT: { icon: Layers, color: "#6366F1" },
  NDYNEX: { icon: Hexagon, color: "#FB7185" },
};
