import type { Format } from "./media.js";
import type { DiscoveryQuery, NormalizedEntity } from "./provider.js";

export interface CatalogProvider {
  readonly id: string;
  readonly format: Format;
  discover(query: DiscoveryQuery): Promise<NormalizedEntity[]>;
  getEntity(externalId: string): Promise<NormalizedEntity>;
}

export interface DiscoveryResult {
  items: NormalizedEntity[];
  source: string;
  stale: boolean;
  updatedAt: string;
}
