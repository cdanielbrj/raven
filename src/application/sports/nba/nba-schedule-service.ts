import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  BallDontLieNbaProvider,
  type NbaGame,
  type NbaTeam,
} from "../../../api/external/balldontlie/nba-schedule-provider.js";
import type { NormalizedEntity } from "../../../models/provider.js";
import { TrackingService } from "../../core/tracking/tracking-service.js";

const providerId = "balldontlie-nba";

export class NbaScheduleService {
  private activeRefresh: Promise<{ refreshed: number }> | undefined;

  constructor(
    private readonly database: Database.Database,
    private readonly provider: BallDontLieNbaProvider,
    private readonly tracking: TrackingService,
    private readonly now = () => new Date(),
  ) {}

  listUpcoming(now = this.now()) {
    return this.tracking.listTimeline("sport", now, now);
  }

  refresh(): Promise<{ refreshed: number }> {
    if (this.activeRefresh) return this.activeRefresh;
    const refresh = this.refreshSchedule().finally(() => {
      if (this.activeRefresh === refresh) this.activeRefresh = undefined;
    });
    this.activeRefresh = refresh;
    return refresh;
  }

  private async refreshSchedule(): Promise<{ refreshed: number }> {
    const trackedTeams = this.database
      .prepare(
        `SELECT e.external_id AS externalId
         FROM entities e
         JOIN tracking t ON t.entity_id = e.id AND t.enabled = 1
         WHERE e.provider = ? AND e.format = 'sport'
         ORDER BY e.external_id`,
      )
      .all(providerId) as Array<{ externalId: string }>;
    const trackedIds = new Set(trackedTeams.map((team) => team.externalId));

    const games = trackedIds.size
      ? await this.provider.listSeasonGames(nbaSeasonStartYear(this.now()), [
          ...trackedIds,
        ])
      : [];
    const relevantGames = games.filter(
      (game) =>
        trackedIds.has(game.homeTeam.externalId) ||
        trackedIds.has(game.awayTeam.externalId),
    );
    const timestamp = this.now().toISOString();
    const isDismissed = this.database.prepare(
      `SELECT 1 FROM dismissed_events
       WHERE provider = ? AND external_event_id = ? AND expires_at > ?`,
    );

    const refreshed = this.database.transaction(() => {
      this.database
        .prepare("DELETE FROM events WHERE provider = ? AND type = 'game'")
        .run(providerId);
      this.database
        .prepare("DELETE FROM dismissed_events WHERE expires_at <= ?")
        .run(timestamp);

      const competitionId = ensureEntity(
        this.database,
        competitionEntity,
        timestamp,
      );
      const teamEntityIds = new Map<string, string>();
      for (const game of relevantGames) {
        teamEntityIds.set(
          game.homeTeam.externalId,
          ensureTeamEntity(this.database, game.homeTeam, timestamp),
        );
        teamEntityIds.set(
          game.awayTeam.externalId,
          ensureTeamEntity(this.database, game.awayTeam, timestamp),
        );
      }

      const insertGame = this.database.prepare(
        `INSERT INTO events (
          id, entity_id, name, type, format, episode_number, starts_at, starts_on,
          time_precision, ends_at, provider, external_id, external_url, source,
          metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertParticipant = this.database.prepare(
        `INSERT INTO event_participants (event_id, entity_id, role)
         VALUES (?, ?, ?)`,
      );
      let count = 0;

      for (const game of relevantGames) {
        if (isDismissed.get(providerId, game.externalId, timestamp)) continue;
        const eventId = randomUUID();
        insertGame.run(
          eventId,
          competitionId,
          `${game.awayTeam.name} at ${game.homeTeam.name}`,
          "game",
          "sport",
          null,
          game.startsAt,
          null,
          "datetime",
          null,
          providerId,
          game.externalId,
          null,
          null,
          JSON.stringify(gameMetadata(game)),
          timestamp,
          timestamp,
        );
        insertParticipant.run(
          eventId,
          teamEntityIds.get(game.homeTeam.externalId),
          "home",
        );
        insertParticipant.run(
          eventId,
          teamEntityIds.get(game.awayTeam.externalId),
          "away",
        );
        count += 1;
      }
      return count;
    })();

    return { refreshed };
  }
}

const competitionEntity: NormalizedEntity = {
  format: "sport",
  name: "NBA",
  provider: providerId,
  externalId: "league:nba",
  coverUrl: null,
  iconUrl: null,
  externalUrl: null,
  metadata: { competition: { id: "nba", name: "NBA", sport: "basketball" } },
};

function ensureEntity(
  database: Database.Database,
  entity: NormalizedEntity,
  timestamp: string,
): string {
  database
    .prepare(
      `INSERT INTO entities (
        id, format, name, provider, external_id, cover_url, icon_url,
        external_url, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, external_id) DO NOTHING`,
    )
    .run(
      randomUUID(),
      entity.format,
      entity.name,
      entity.provider,
      entity.externalId,
      entity.coverUrl,
      entity.iconUrl,
      entity.externalUrl,
      JSON.stringify(entity.metadata),
      timestamp,
      timestamp,
    );
  return (
    database
      .prepare("SELECT id FROM entities WHERE provider = ? AND external_id = ?")
      .get(entity.provider, entity.externalId) as { id: string }
  ).id;
}

function ensureTeamEntity(
  database: Database.Database,
  team: NbaTeam,
  timestamp: string,
): string {
  return ensureEntity(
    database,
    {
      ...competitionEntity,
      name: team.name,
      externalId: team.externalId,
      metadata: {
        competition: { id: "nba", name: "NBA", sport: "basketball" },
        abbreviation: team.abbreviation,
        conference: team.conference,
        division: team.division,
      },
    },
    timestamp,
  );
}

function gameMetadata(game: NbaGame): Record<string, unknown> {
  return {
    season: game.season,
    status: game.status,
    postponed: game.postponed,
    postseason: game.postseason,
    homeTeam: {
      externalId: game.homeTeam.externalId,
      name: game.homeTeam.name,
      abbreviation: game.homeTeam.abbreviation,
    },
    awayTeam: {
      externalId: game.awayTeam.externalId,
      name: game.awayTeam.name,
      abbreviation: game.awayTeam.abbreviation,
    },
  };
}

function nbaSeasonStartYear(now: Date): number {
  return now.getFullYear() - (now.getMonth() < 6 ? 1 : 0);
}
