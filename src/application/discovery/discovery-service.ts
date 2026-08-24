import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { DiscoveryResult } from "../../models/catalog.js";
import type { Format } from "../../models/media.js";
import {
  ProviderRequestError,
  type DiscoveryQuery,
  type NormalizedEntity,
} from "../../models/provider.js";
import type { CatalogProvider } from "../../models/catalog.js";

export class DiscoveryService {
  private readonly providers: CatalogProvider[];

  constructor(
    private readonly database: Database.Database,
    primary: CatalogProvider | CatalogProvider[],
    fallback?: CatalogProvider,
  ) {
    this.providers = Array.isArray(primary)
      ? primary
      : [primary, ...(fallback ? [fallback] : [])];
  }

  async discover(
    format: Format,
    query: DiscoveryQuery,
  ): Promise<DiscoveryResult> {
    const [primary, ...fallbacks] = this.providersFor(format);
    if (!primary) {
      throw new ProviderRequestError(`No catalog provider for ${format}`);
    }

    try {
      const items = await primary.discover(query);
      return this.persist(primary.id, format, query, items);
    } catch (primaryError) {
      if (!canFallback(primaryError) || fallbacks.length === 0) {
        return this.fromSnapshotOrThrow(format, query, primaryError);
      }

      let fallbackError: unknown = primaryError;
      for (const fallback of fallbacks) {
        try {
          const items = await fallback.discover(query);
          return this.persist(fallback.id, format, query, items);
        } catch (error) {
          fallbackError = error;
          if (!canFallback(error)) break;
        }
      }
      return this.fromSnapshotOrThrow(format, query, fallbackError);
    }
  }

  async discoverCached(
    format: Format,
    query: DiscoveryQuery,
    maxAgeMs: number,
  ): Promise<DiscoveryResult> {
    const snapshot = this.readSnapshot(format, query);
    if (
      snapshot &&
      Date.now() - new Date(snapshot.updatedAt).getTime() <= maxAgeMs
    ) {
      return { ...snapshot, stale: false };
    }
    return this.discover(format, query);
  }

  async getEntity(
    format: Format,
    providerId: string,
    externalId: string,
  ): Promise<NormalizedEntity> {
    const provider = this.providersFor(format).find(
      (candidate) => candidate.id === providerId,
    );
    if (!provider) {
      throw new ProviderRequestError(
        `Catalog provider ${providerId} is not configured`,
        404,
      );
    }
    const cached = this.findCachedEntity(format, providerId, externalId);
    if (cached) return cached;
    return provider.getEntity(externalId);
  }

  private providersFor(format: Format): CatalogProvider[] {
    return this.providers.filter((provider) => provider.format === format);
  }

  private persist(
    provider: string,
    format: Format,
    query: DiscoveryQuery,
    items: NormalizedEntity[],
  ): DiscoveryResult {
    const fetchedAt = new Date().toISOString();
    const queryKey = discoveryQueryKey(query);
    const existing = this.database
      .prepare(
        `SELECT id FROM discovery_snapshots
         WHERE format = ? AND provider = ? AND query_key = ?`,
      )
      .get(format, provider, queryKey) as { id: string } | undefined;
    const snapshotId = existing?.id ?? randomUUID();

    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO discovery_snapshots (
            id, format, provider, query_key, fetched_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(format, provider, query_key) DO UPDATE SET
            fetched_at = excluded.fetched_at`,
        )
        .run(snapshotId, format, provider, queryKey, fetchedAt);
      this.database
        .prepare("DELETE FROM discovery_snapshot_items WHERE snapshot_id = ?")
        .run(snapshotId);
      const insert = this.database.prepare(
        `INSERT INTO discovery_snapshot_items (snapshot_id, position, entity)
         VALUES (?, ?, ?)`,
      );
      items.forEach((item, position) =>
        insert.run(snapshotId, position, JSON.stringify(item)),
      );
    })();

    return { items, source: provider, stale: false, updatedAt: fetchedAt };
  }

  private fromSnapshotOrThrow(
    format: Format,
    query: DiscoveryQuery,
    error: unknown,
  ): DiscoveryResult {
    const snapshot = this.readSnapshot(format, query);
    if (!snapshot) throw error;
    return { ...snapshot, stale: true };
  }

  private readSnapshot(
    format: Format,
    query: DiscoveryQuery,
  ): DiscoveryResult | undefined {
    const snapshot = this.database
      .prepare(
        `SELECT id, provider, fetched_at FROM discovery_snapshots
         WHERE format = ? AND query_key = ?
         ORDER BY fetched_at DESC LIMIT 1`,
      )
      .get(format, discoveryQueryKey(query)) as
      | { id: string; provider: string; fetched_at: string }
      | undefined;
    if (!snapshot) return undefined;

    const items = this.database
      .prepare(
        `SELECT entity FROM discovery_snapshot_items
         WHERE snapshot_id = ? ORDER BY position ASC`,
      )
      .all(snapshot.id)
      .map((row) =>
        JSON.parse((row as { entity: string }).entity),
      ) as NormalizedEntity[];
    return {
      items,
      source: snapshot.provider,
      stale: false,
      updatedAt: snapshot.fetched_at,
    };
  }

  private findCachedEntity(
    format: Format,
    provider: string,
    externalId: string,
  ): NormalizedEntity | undefined {
    const snapshots = this.database
      .prepare(
        `SELECT id FROM discovery_snapshots
         WHERE format = ? AND provider = ? ORDER BY fetched_at DESC`,
      )
      .all(format, provider) as Array<{ id: string }>;

    for (const snapshot of snapshots) {
      const rows = this.database
        .prepare(
          `SELECT entity FROM discovery_snapshot_items
           WHERE snapshot_id = ? ORDER BY position ASC`,
        )
        .all(snapshot.id) as Array<{ entity: string }>;
      const entity = rows
        .map((row) => JSON.parse(row.entity) as NormalizedEntity)
        .find((item) => item.externalId === externalId);
      if (entity) return entity;
    }
    return undefined;
  }
}

function canFallback(error: unknown): boolean {
  if (!(error instanceof ProviderRequestError)) return false;
  const status = error.statusCode;
  return (
    status === undefined || status === 403 || status === 429 || status >= 500
  );
}

function discoveryQueryKey(query: DiscoveryQuery): string {
  return JSON.stringify({
    kind: query.kind ?? "search",
    search: query.search?.trim().toLocaleLowerCase() ?? null,
    page: query.page ?? 1,
  });
}
