import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { Entity, Event, Tracking } from "../../../models/media.js";
import { ProviderRegistry } from "./provider-registry.js";
import type { NormalizedEntity, Provider } from "../../../models/provider.js";

export interface TrackedEntity {
  entity: Entity;
  tracking: Tracking;
  nextEvent: Event | null;
  syncStatus: "synced" | "pending";
}

export interface TimelineEvent extends Event {
  entity: Pick<
    Entity,
    | "id"
    | "name"
    | "format"
    | "coverUrl"
    | "iconUrl"
    | "externalUrl"
    | "metadata"
  >;
}

export class TrackingService {
  constructor(
    private readonly database: Database.Database,
    private readonly providers: ProviderRegistry,
  ) {}

  async track(
    format: Entity["format"],
    externalId: string,
  ): Promise<TrackedEntity> {
    return this.trackWithProvider(
      this.providers.primaryFor(format),
      externalId,
    );
  }

  async trackEntity(entity: NormalizedEntity): Promise<TrackedEntity> {
    const now = new Date().toISOString();
    const existing = this.database
      .prepare("SELECT id FROM entities WHERE provider = ? AND external_id = ?")
      .get(entity.provider, entity.externalId) as { id: string } | undefined;
    const entityId = existing?.id ?? randomUUID();
    const trackingId = this.database
      .prepare("SELECT id FROM tracking WHERE entity_id = ?")
      .get(entityId) as { id: string } | undefined;

    this.database.transaction(() => {
      this.database
        .prepare(
          `
        INSERT INTO entities (
          id, format, name, provider, external_id, cover_url, icon_url, external_url, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, external_id) DO UPDATE SET
          format = excluded.format,
          name = excluded.name,
          cover_url = excluded.cover_url,
          icon_url = excluded.icon_url,
          external_url = excluded.external_url,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
      `,
        )
        .run(
          entityId,
          entity.format,
          entity.name,
          entity.provider,
          entity.externalId,
          entity.coverUrl,
          entity.iconUrl,
          entity.externalUrl,
          stringify(entity.metadata),
          now,
          now,
        );

      this.database
        .prepare(
          `
        INSERT INTO tracking (id, entity_id, enabled, preferences, created_at, updated_at)
        VALUES (?, ?, 1, NULL, ?, ?)
        ON CONFLICT(entity_id) DO UPDATE SET enabled = 1, updated_at = excluded.updated_at
      `,
        )
        .run(trackingId?.id ?? randomUUID(), entityId, now, now);
    })();

    if (this.providers.has(entity.provider, entity.format)) {
      await this.syncEntity(entityId, entity);
    }
    return this.getTrackedEntity(entityId);
  }

  private async trackWithProvider(
    provider: Provider,
    externalId: string,
  ): Promise<TrackedEntity> {
    return this.trackEntity(await provider.getEntity(externalId));
  }

  async refreshAll(format: Entity["format"]): Promise<number> {
    const tracked = this.listTracked(format);
    for (const item of tracked) {
      if (!this.providers.has(item.entity.provider, item.entity.format))
        continue;
      const provider = this.providers.get(
        item.entity.provider,
        item.entity.format,
      );
      await this.trackWithProvider(provider, item.entity.externalId);
    }
    return tracked.length;
  }

  untrack(entityId: string): boolean {
    const result = this.database
      .prepare("DELETE FROM entities WHERE id = ?")
      .run(entityId);
    return result.changes > 0;
  }

  listTracked(format?: Entity["format"], now = new Date()): TrackedEntity[] {
    const nowIso = now.toISOString();
    const today = nowIso.slice(0, 10);
    const rows = this.database
      .prepare(
        `
      SELECT
        e.*,
        t.id AS tracking_id, t.enabled AS tracking_enabled, t.preferences AS tracking_preferences,
        t.created_at AS tracking_created_at, t.updated_at AS tracking_updated_at,
        ne.id AS next_event_id, ne.name AS next_event_name, ne.type AS next_event_type,
        ne.format AS next_event_format, ne.episode_number AS next_event_episode_number,
        ne.starts_at AS next_event_starts_at, ne.starts_on AS next_event_starts_on,
        ne.time_precision AS next_event_time_precision, ne.ends_at AS next_event_ends_at,
        ne.provider AS next_event_provider, ne.external_id AS next_event_external_id,
        ne.external_url AS next_event_external_url, ne.source AS next_event_source,
        ne.metadata AS next_event_metadata, ne.created_at AS next_event_created_at,
        ne.updated_at AS next_event_updated_at
      FROM entities e
      JOIN tracking t ON t.entity_id = e.id AND t.enabled = 1
      LEFT JOIN events ne ON ne.id = (
        SELECT events.id FROM events
        WHERE (
          events.entity_id = e.id
          OR EXISTS (
            SELECT 1 FROM event_participants
            WHERE event_participants.event_id = events.id
              AND event_participants.entity_id = e.id
          )
        )
          AND (events.starts_at >= ? OR events.starts_on >= ?)
        ORDER BY COALESCE(events.starts_at, events.starts_on) ASC
        LIMIT 1
      )
      ${format ? "WHERE e.format = ?" : ""}
      ORDER BY e.name COLLATE NOCASE ASC
    `,
      )
      .all(nowIso, today, ...(format ? [format] : [])) as Record<
      string,
      unknown
    >[];

    return rows.map((row) => {
      const item = trackedEntityFromRow(row);
      return {
        ...item,
        syncStatus: this.providers.has(item.entity.provider, item.entity.format)
          ? "synced"
          : "pending",
      };
    });
  }

  listTimeline(
    format?: Entity["format"],
    now = new Date(),
    startsAtOrAfter?: Date,
  ): TimelineEvent[] {
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndIso = weekEnd.toISOString();
    const rangeStartIso = (startsAtOrAfter ?? weekStart).toISOString();
    const rangeStartDay = rangeStartIso.slice(0, 10);
    const weekEndDay = weekEndIso.slice(0, 10);
    const rows = this.database
      .prepare(
        `
      SELECT ev.*, e.name AS entity_name, e.cover_url AS entity_cover_url, e.metadata AS entity_metadata,
        e.icon_url AS entity_icon_url, e.external_url AS entity_external_url
      FROM events ev
      JOIN tracking t ON t.enabled = 1 AND (
        t.entity_id = ev.entity_id
        OR EXISTS (
          SELECT 1 FROM event_participants
          WHERE event_participants.event_id = ev.id
            AND event_participants.entity_id = t.entity_id
        )
      )
      JOIN entities e ON e.id = ev.entity_id
      WHERE
        (ev.starts_at >= ? OR ev.starts_on >= ?)
        AND (ev.starts_at < ? OR ev.starts_on < ?)
        ${format ? "AND ev.format = ?" : ""}
      ORDER BY COALESCE(ev.starts_at, ev.starts_on) ASC
    `,
      )
      .all(
        rangeStartIso,
        rangeStartDay,
        weekEndIso,
        weekEndDay,
        ...(format ? [format] : []),
      ) as Record<string, unknown>[];

    const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()];
    return uniqueRows.map((row) => ({
      ...eventFromRow(row),
      entity: {
        id: row.entity_id as string,
        name: row.entity_name as string,
        format: row.format as Entity["format"],
        coverUrl: nullableString(row.entity_cover_url),
        iconUrl: nullableString(row.entity_icon_url),
        externalUrl: nullableString(row.entity_external_url),
        metadata: parseJson(row.entity_metadata),
      },
    }));
  }

  markWatched(eventId: string): boolean {
    const event = this.database
      .prepare(
        `
      SELECT id, entity_id, provider, external_id, starts_at, starts_on FROM events WHERE id = ?
    `,
      )
      .get(eventId) as
      | {
          id: string;
          entity_id: string;
          provider: string;
          external_id: string | null;
          starts_at: string | null;
          starts_on: string | null;
        }
      | undefined;

    if (!event) return false;

    const now = new Date().toISOString();
    const expiresAt = new Date(
      new Date(
        event.starts_at ?? `${event.starts_on}T23:59:59.999Z`,
      ).getTime() +
        7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    this.database.transaction(() => {
      if (event.external_id) {
        this.database
          .prepare(
            `
          INSERT INTO dismissed_events (provider, external_event_id, entity_id, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(provider, external_event_id) DO UPDATE SET expires_at = excluded.expires_at
        `,
          )
          .run(
            event.provider,
            event.external_id,
            event.entity_id,
            expiresAt,
            now,
          );
      }
      this.database.prepare("DELETE FROM events WHERE id = ?").run(event.id);
    })();

    return true;
  }

  private async syncEntity(
    entityId: string,
    entity: NormalizedEntity,
  ): Promise<void> {
    const provider = this.providers.get(entity.provider, entity.format);
    const events = await provider.getEvents(entity);
    const now = new Date().toISOString();
    const isDismissed = this.database.prepare(`
      SELECT 1 FROM dismissed_events
      WHERE provider = ? AND external_event_id = ? AND expires_at > ?
    `);

    this.database.transaction(() => {
      this.database
        .prepare("DELETE FROM dismissed_events WHERE expires_at <= ?")
        .run(now);
      this.database
        .prepare("DELETE FROM events WHERE entity_id = ? AND provider = ?")
        .run(entityId, entity.provider);
      const upsertEvent = this.database.prepare(`
        INSERT INTO events (
          id, entity_id, name, type, format, episode_number, starts_at, starts_on, time_precision,
          ends_at, provider, external_id, external_url, source, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, external_id) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          format = excluded.format,
          episode_number = excluded.episode_number,
          starts_at = excluded.starts_at,
          starts_on = excluded.starts_on,
          time_precision = excluded.time_precision,
          ends_at = excluded.ends_at,
          external_url = excluded.external_url,
          source = excluded.source,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
      `);
      const eventIdByExternalId = this.database.prepare(
        "SELECT id FROM events WHERE provider = ? AND external_id = ?",
      );
      const upsertParticipant = this.database.prepare(`
        INSERT INTO event_participants (event_id, entity_id, role)
        VALUES (?, ?, ?)
        ON CONFLICT(event_id, entity_id) DO UPDATE SET role = excluded.role
      `);

      for (const event of events) {
        if (
          event.externalId &&
          isDismissed.get(event.provider, event.externalId, now)
        )
          continue;
        const eventId = randomUUID();
        upsertEvent.run(
          eventId,
          entityId,
          event.name,
          event.type,
          event.format,
          event.episodeNumber,
          event.startsAt,
          event.startsOn,
          event.timePrecision,
          event.endsAt,
          event.provider,
          event.externalId,
          event.externalUrl,
          event.source,
          stringify(event.metadata),
          now,
          now,
        );
        const persistedEventId = event.externalId
          ? (
              eventIdByExternalId.get(event.provider, event.externalId) as {
                id: string;
              }
            ).id
          : eventId;
        upsertParticipant.run(persistedEventId, entityId, "subject");
      }
    })();
  }

  private getTrackedEntity(entityId: string): TrackedEntity {
    const item = this.listTracked().find(
      (candidate) => candidate.entity.id === entityId,
    );
    if (!item) throw new Error(`Tracking ${entityId} was not persisted`);
    return item;
  }
}

function trackedEntityFromRow(
  row: Record<string, unknown>,
): Omit<TrackedEntity, "syncStatus"> {
  const entity = entityFromRow(row);
  return {
    entity,
    tracking: {
      id: row.tracking_id as string,
      entityId: entity.id,
      enabled: row.tracking_enabled === 1,
      preferences: parseJson(row.tracking_preferences),
      createdAt: row.tracking_created_at as string,
      updatedAt: row.tracking_updated_at as string,
    },
    nextEvent: row.next_event_id
      ? eventFromRow(prefixRow(row, "next_event_"), entity.id)
      : null,
  };
}

function entityFromRow(row: Record<string, unknown>): Entity {
  return {
    id: row.id as string,
    format: row.format as Entity["format"],
    name: row.name as string,
    provider: row.provider as string,
    externalId: row.external_id as string,
    coverUrl: nullableString(row.cover_url),
    iconUrl: nullableString(row.icon_url),
    externalUrl: nullableString(row.external_url),
    metadata: parseJson(row.metadata),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function eventFromRow(
  row: Record<string, unknown>,
  entityId = row.entity_id as string,
): Event {
  return {
    id: row.id as string,
    entityId,
    name: nullableString(row.name),
    type: row.type as string,
    format: row.format as Event["format"],
    episodeNumber: nullableNumber(row.episode_number),
    startsAt: nullableString(row.starts_at),
    startsOn: nullableString(row.starts_on),
    timePrecision: row.time_precision as Event["timePrecision"],
    endsAt: nullableString(row.ends_at),
    provider: row.provider as string,
    externalId: nullableString(row.external_id),
    externalUrl: nullableString(row.external_url),
    source: nullableString(row.source),
    metadata: parseJson(row.metadata),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function prefixRow(
  row: Record<string, unknown>,
  prefix: string,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );
}

function stringify(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

function parseJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return null;
  return JSON.parse(value) as Record<string, unknown>;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
