import fs from "node:fs";
import type Database from "better-sqlite3";

export type ProviderConnectionStatus =
  | "available"
  | "not_checked"
  | "not_configured"
  | "unavailable";

export interface ProviderHealthTarget {
  id: string;
  label: string;
  configured: boolean;
  check?: () => Promise<unknown>;
}

export interface SettingsOverview {
  installation: {
    mode: "local-first";
    version: string;
  };
  database: {
    sizeBytes: number;
    schemaVersion: number;
    trackedItems: number;
    upcomingEvents: number;
    discoverySnapshots: number;
  };
  providers: Array<{
    id: string;
    label: string;
    status: ProviderConnectionStatus;
    lastCheckedAt: string | null;
    lastSucceededAt: string | null;
  }>;
}

export class ProviderHealthTargetNotFoundError extends Error {
  constructor(providerId: string) {
    super(`Provider ${providerId} is not configured for health checks`);
    this.name = "ProviderHealthTargetNotFoundError";
  }
}

export class SettingsService {
  constructor(
    private readonly database: Database.Database,
    private readonly databasePath: string,
    private readonly providers: ProviderHealthTarget[],
    private readonly version: string,
  ) {}

  getOverview(): SettingsOverview {
    const now = new Date();
    const counts = {
      trackedItems: count(
        this.database,
        "SELECT COUNT(*) AS count FROM tracking WHERE enabled = 1",
      ),
      upcomingEvents: count(
        this.database,
        `SELECT COUNT(*) AS count FROM events
         WHERE (starts_at IS NOT NULL AND starts_at >= ?)
            OR (starts_on IS NOT NULL AND starts_on >= ?)`,
        [now.toISOString(), now.toISOString().slice(0, 10)],
      ),
      discoverySnapshots: count(
        this.database,
        "SELECT COUNT(*) AS count FROM discovery_snapshots",
      ),
      schemaVersion: count(
        this.database,
        "SELECT COUNT(*) AS count FROM schema_migrations",
      ),
    };

    return {
      installation: { mode: "local-first", version: this.version },
      database: {
        sizeBytes: databaseSize(this.databasePath),
        ...counts,
      },
      providers: this.providers.map((provider) =>
        this.providerStatus(provider),
      ),
    };
  }

  async checkProvider(providerId: string): Promise<SettingsOverview> {
    const provider = this.providers.find((item) => item.id === providerId);
    if (!provider) {
      throw new ProviderHealthTargetNotFoundError(providerId);
    }
    if (!provider.configured || !provider.check) {
      return this.getOverview();
    }

    const checkedAt = new Date().toISOString();
    try {
      await provider.check();
      this.recordProviderCheck(provider.id, "available", checkedAt);
    } catch {
      this.recordProviderCheck(provider.id, "unavailable", checkedAt);
    }
    return this.getOverview();
  }

  private providerStatus(
    provider: ProviderHealthTarget,
  ): SettingsOverview["providers"][number] {
    if (!provider.configured) {
      return {
        id: provider.id,
        label: provider.label,
        status: "not_configured",
        lastCheckedAt: null,
        lastSucceededAt: null,
      };
    }

    const row = this.database
      .prepare(
        `SELECT status, last_checked_at, last_succeeded_at
         FROM provider_health WHERE provider = ?`,
      )
      .get(provider.id) as
      | {
          status: ProviderConnectionStatus;
          last_checked_at: string | null;
          last_succeeded_at: string | null;
        }
      | undefined;
    return {
      id: provider.id,
      label: provider.label,
      status: row?.status ?? "not_checked",
      lastCheckedAt: row?.last_checked_at ?? null,
      lastSucceededAt: row?.last_succeeded_at ?? null,
    };
  }

  private recordProviderCheck(
    provider: string,
    status: Extract<ProviderConnectionStatus, "available" | "unavailable">,
    checkedAt: string,
  ): void {
    this.database
      .prepare(
        `INSERT INTO provider_health (
          provider, status, last_checked_at, last_succeeded_at, updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(provider) DO UPDATE SET
          status = excluded.status,
          last_checked_at = excluded.last_checked_at,
          last_succeeded_at = COALESCE(
            excluded.last_succeeded_at, provider_health.last_succeeded_at
          ),
          updated_at = excluded.updated_at`,
      )
      .run(
        provider,
        status,
        checkedAt,
        status === "available" ? checkedAt : null,
        checkedAt,
      );
  }
}

function count(
  database: Database.Database,
  query: string,
  parameters: unknown[] = [],
): number {
  return (database.prepare(query).get(...parameters) as { count: number })
    .count;
}

function databaseSize(databasePath: string): number {
  return [databasePath, `${databasePath}-wal`, `${databasePath}-shm`].reduce(
    (size, path) => {
      try {
        return size + fs.statSync(path).size;
      } catch {
        return size;
      }
    },
    0,
  );
}
