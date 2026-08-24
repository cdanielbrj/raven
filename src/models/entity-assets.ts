import type { NormalizedEntity } from "./provider.js";

/**
 * Supplementary visual identity is deliberately separate from the catalog or
 * schedule provider. A sports schedule can therefore remain usable when an
 * asset source is unavailable or changes in the future.
 */
export interface ResolvedEntityAssets {
  sourceExternalId: string | null;
  iconUrl: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
}

export interface EntityAssetProvider {
  readonly id: string;
  resolveEntity(entity: NormalizedEntity): Promise<ResolvedEntityAssets | null>;
}

export interface EntityAssetCoverage {
  status: "complete" | "partial" | "syncing";
  resolved: number;
  missing: number;
  total: number;
}
