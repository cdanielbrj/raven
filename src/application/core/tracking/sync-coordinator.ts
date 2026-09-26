import type Database from "better-sqlite3";
import type { Format } from "../../../models/media.js";
import { ProviderRegistry } from "./provider-registry.js";
import { ProviderRequestError } from "../../../models/provider.js";
import { TrackingService } from "./tracking-service.js";

export class SyncCoordinator {
  private readonly inFlight = new Map<Format, Promise<{ refreshed: number }>>();

  constructor(
    private readonly database: Database.Database,
    private readonly providers: ProviderRegistry,
    private readonly tracking: TrackingService,
  ) {}

  async refreshFormat(format: Format): Promise<{ refreshed: number }> {
    const existing = this.inFlight.get(format);
    if (existing) return existing;

    const refresh = this.performRefresh(format).finally(() => {
      this.inFlight.delete(format);
    });
    this.inFlight.set(format, refresh);
    return refresh;
  }

  private async performRefresh(format: Format): Promise<{ refreshed: number }> {
    const providers = this.providers.listForFormat(format);
    const startedAt = new Date().toISOString();
    for (const provider of providers)
      this.recordStarted(provider.id, startedAt);

    try {
      const refreshed = await this.tracking.refreshAll(format);
      const succeededAt = new Date().toISOString();
      for (const provider of providers)
        this.recordSucceeded(provider.id, succeededAt);
      return { refreshed };
    } catch (error) {
      const failedAt = new Date().toISOString();
      const message =
        error instanceof Error ? error.message : "Unknown sync failure";
      const retryAfterAt =
        error instanceof ProviderRequestError && error.retryAfterSeconds
          ? new Date(Date.now() + error.retryAfterSeconds * 1_000).toISOString()
          : null;
      for (const provider of providers)
        this.recordFailed(provider.id, failedAt, message, retryAfterAt);
      throw error;
    }
  }

  private recordStarted(providerId: string, now: string): void {
    this.database
      .prepare(
        `
      INSERT INTO provider_sync_state (provider, last_started_at, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET last_started_at = excluded.last_started_at, updated_at = excluded.updated_at
    `,
      )
      .run(providerId, now, now);
  }

  private recordSucceeded(providerId: string, now: string): void {
    this.database
      .prepare(
        `
      UPDATE provider_sync_state
      SET last_succeeded_at = ?, last_error = NULL, retry_after_at = NULL, updated_at = ?
      WHERE provider = ?
    `,
      )
      .run(now, now, providerId);
  }

  private recordFailed(
    providerId: string,
    now: string,
    error: string,
    retryAfterAt: string | null,
  ): void {
    this.database
      .prepare(
        `
      UPDATE provider_sync_state
      SET last_failed_at = ?, last_error = ?, retry_after_at = ?, updated_at = ?
      WHERE provider = ?
    `,
      )
      .run(now, error, retryAfterAt, now, providerId);
  }
}
