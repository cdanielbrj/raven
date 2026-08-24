import type Database from "better-sqlite3";
import type {
  EntityAssetCoverage,
  EntityAssetProvider,
  ResolvedEntityAssets,
} from "../../models/entity-assets.js";
import type { NormalizedEntity } from "../../models/provider.js";

interface StoredAssets extends ResolvedEntityAssets {
  entityExternalId: string;
}

export interface NbaTeamIdentityResult {
  items: NormalizedEntity[];
  coverage: EntityAssetCoverage;
}

/**
 * Caches team artwork locally and refreshes only unknown teams. The initial
 * roster request never waits for artwork: a single, rate-aware background job
 * fills the local cache while the UI retains its text fallback.
 */
export class NbaTeamIdentityService {
  private activeSync: Promise<void> | undefined;

  constructor(
    private readonly database: Database.Database,
    private readonly provider: EntityAssetProvider,
    private readonly minimumRequestIntervalMs = 2_100,
  ) {}

  enrich(teams: NormalizedEntity[]): NbaTeamIdentityResult {
    const stored = this.readStoredAssets(teams);
    const items = teams.map((team) =>
      applyAssets(team, stored.get(team.externalId)),
    );
    const unresolved = teams.filter(
      (team) => !stored.get(team.externalId)?.iconUrl,
    );

    if (unresolved.length > 0 && !this.activeSync) {
      const sync = this.synchronize(unresolved);
      this.activeSync = sync;
      void sync.then(
        () => {
          if (this.activeSync === sync) this.activeSync = undefined;
        },
        () => {
          if (this.activeSync === sync) this.activeSync = undefined;
        },
      );
    }

    const resolved = items.filter((team) => Boolean(team.iconUrl)).length;
    return {
      items,
      coverage: {
        status: this.activeSync
          ? "syncing"
          : resolved === teams.length
            ? "complete"
            : "partial",
        resolved,
        missing: teams.length - resolved,
        total: teams.length,
      },
    };
  }

  private readStoredAssets(
    teams: NormalizedEntity[],
  ): Map<string, StoredAssets> {
    if (teams.length === 0) return new Map();
    const ids = teams.map((team) => team.externalId);
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.database
      .prepare(
        `SELECT entity_external_id, source_external_id, icon_url, logo_url, banner_url
         FROM entity_assets
         WHERE entity_provider = ? AND asset_provider = ?
           AND entity_external_id IN (${placeholders})`,
      )
      .all("balldontlie-nba", this.provider.id, ...ids) as Array<{
      entity_external_id: string;
      source_external_id: string | null;
      icon_url: string | null;
      logo_url: string | null;
      banner_url: string | null;
    }>;

    return new Map(
      rows.map((row) => [
        row.entity_external_id,
        {
          entityExternalId: row.entity_external_id,
          sourceExternalId: row.source_external_id,
          iconUrl: row.icon_url,
          logoUrl: row.logo_url,
          bannerUrl: row.banner_url,
        },
      ]),
    );
  }

  private async synchronize(teams: NormalizedEntity[]): Promise<void> {
    for (const [index, team] of teams.entries()) {
      try {
        const assets = await this.provider.resolveEntity(team);
        this.store(team, assets);
      } catch {
        // An unavailable artwork source must not break the NBA catalog. A
        // failed request remains retryable on a later catalog visit.
      }

      if (index < teams.length - 1 && this.minimumRequestIntervalMs > 0) {
        await delay(this.minimumRequestIntervalMs);
      }
    }
  }

  private store(
    team: NormalizedEntity,
    assets: ResolvedEntityAssets | null,
  ): void {
    this.database
      .prepare(
        `INSERT INTO entity_assets (
          entity_provider, entity_external_id, asset_provider,
          source_external_id, icon_url, logo_url, banner_url, fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(entity_provider, entity_external_id, asset_provider) DO UPDATE SET
          source_external_id = excluded.source_external_id,
          icon_url = excluded.icon_url,
          logo_url = excluded.logo_url,
          banner_url = excluded.banner_url,
          fetched_at = excluded.fetched_at`,
      )
      .run(
        team.provider,
        team.externalId,
        this.provider.id,
        assets?.sourceExternalId ?? null,
        assets?.iconUrl ?? null,
        assets?.logoUrl ?? null,
        assets?.bannerUrl ?? null,
        new Date().toISOString(),
      );
  }
}

function applyAssets(
  team: NormalizedEntity,
  assets: StoredAssets | undefined,
): NormalizedEntity {
  if (!assets) return team;
  return {
    ...team,
    iconUrl: assets.iconUrl,
    coverUrl: assets.bannerUrl,
    metadata: {
      ...team.metadata,
      assetSource: assets.sourceExternalId
        ? { provider: "thesportsdb", externalId: assets.sourceExternalId }
        : undefined,
    },
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
