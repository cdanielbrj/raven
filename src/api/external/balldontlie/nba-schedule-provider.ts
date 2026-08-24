import type { CatalogProvider } from "../../../models/catalog.js";
import {
  ProviderRequestError,
  type DiscoveryQuery,
  type NormalizedEntity,
} from "../../../models/provider.js";

const endpoint = "https://api.balldontlie.io/v1";
const requestTimeoutMs = 10_000;

interface BallDontLieTeam {
  id: number;
  conference: string;
  division: string;
  city: string;
  name: string;
  full_name: string;
  abbreviation: string;
}

interface BallDontLieGame {
  id: number;
  date: string;
  datetime: string;
  season: number;
  status_state: string;
  postponed: boolean;
  postseason: boolean;
  home_team: BallDontLieTeam;
  visitor_team: BallDontLieTeam;
}

interface BallDontLiePage<T> {
  data: T[];
  meta?: { next_cursor?: number | null };
  error?: string;
}

export interface NbaTeam {
  externalId: string;
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
}

export interface NbaGame {
  externalId: string;
  season: number;
  startsAt: string;
  status: string;
  postponed: boolean;
  postseason: boolean;
  homeTeam: NbaTeam;
  awayTeam: NbaTeam;
}

export class BallDontLieNbaProviderError extends ProviderRequestError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode);
    this.name = "BallDontLieNbaProviderError";
  }
}

export type Fetcher = typeof fetch;

/**
 * External NBA schedule adapter. It intentionally does not implement Raven's
 * entity-centric Provider contract: one NBA game belongs to two teams and is
 * synchronized once per league, never once per followed team.
 */
export class BallDontLieNbaProvider implements CatalogProvider {
  readonly id = "balldontlie-nba";
  readonly format = "sport" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly apiEndpoint = endpoint,
  ) {}

  async listTeams(): Promise<NbaTeam[]> {
    const page = await this.request<BallDontLieTeam>("teams");
    return page.data.map(normalizeTeam);
  }

  async discover(query: DiscoveryQuery): Promise<NormalizedEntity[]> {
    const search = query.search?.trim().toLocaleLowerCase();
    return (await this.listTeams())
      .filter((team) => currentNbaTeamIds.has(team.externalId))
      .filter(
        (team) =>
          !search ||
          `${team.name} ${team.abbreviation}`
            .toLocaleLowerCase()
            .includes(search),
      )
      .map(normalizeEntity);
  }

  async getEntity(externalId: string): Promise<NormalizedEntity> {
    const team = (await this.listTeams()).find(
      (candidate) => candidate.externalId === externalId,
    );
    if (!team || !currentNbaTeamIds.has(team.externalId)) {
      throw new BallDontLieNbaProviderError(
        `NBA team ${externalId} was not found`,
        404,
      );
    }
    return normalizeEntity(team);
  }

  async listSeasonGames(season: number): Promise<NbaGame[]> {
    if (!Number.isInteger(season) || season < 1946) {
      throw new BallDontLieNbaProviderError(
        "NBA season must be a four digit start year",
      );
    }

    const games: NbaGame[] = [];
    const seenCursors = new Set<number>();
    let cursor: number | undefined;

    do {
      const page = await this.request<BallDontLieGame>("games", {
        "seasons[]": String(season),
        per_page: "100",
        ...(cursor === undefined ? {} : { cursor: String(cursor) }),
      });
      games.push(...page.data.map(normalizeGame));

      const nextCursor = page.meta?.next_cursor;
      if (typeof nextCursor !== "number" || seenCursors.has(nextCursor)) {
        cursor = undefined;
      } else {
        seenCursors.add(nextCursor);
        cursor = nextCursor;
      }
    } while (cursor !== undefined);

    return games;
  }

  private async request<T>(
    pathname: string,
    query: Record<string, string> = {},
  ): Promise<BallDontLiePage<T>> {
    const url = new URL(pathname, `${this.apiEndpoint}/`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: { Authorization: this.apiKey },
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      throw new BallDontLieNbaProviderError(
        `BALLDONTLIE request failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as BallDontLiePage<T> | null;
    if (!response.ok || !payload || !Array.isArray(payload.data)) {
      throw new BallDontLieNbaProviderError(
        payload?.error ??
          `BALLDONTLIE request failed with HTTP ${response.status}`,
        response.status,
      );
    }
    return payload;
  }
}

const currentNbaTeamIds = new Set(
  Array.from({ length: 30 }, (_, index) => String(index + 1)),
);

function normalizeTeam(team: BallDontLieTeam): NbaTeam {
  if (!Number.isInteger(team.id) || !team.full_name || !team.abbreviation) {
    throw new BallDontLieNbaProviderError(
      "BALLDONTLIE returned an invalid NBA team",
    );
  }

  return {
    externalId: String(team.id),
    name: team.full_name,
    abbreviation: team.abbreviation,
    conference: team.conference,
    division: team.division,
  };
}

function normalizeGame(game: BallDontLieGame): NbaGame {
  if (!Number.isInteger(game.id) || Number.isNaN(Date.parse(game.datetime))) {
    throw new BallDontLieNbaProviderError(
      "BALLDONTLIE returned an invalid NBA game",
    );
  }

  return {
    externalId: String(game.id),
    season: game.season,
    startsAt: new Date(game.datetime).toISOString(),
    status: game.status_state,
    postponed: game.postponed,
    postseason: game.postseason,
    homeTeam: normalizeTeam(game.home_team),
    awayTeam: normalizeTeam(game.visitor_team),
  };
}

function normalizeEntity(team: NbaTeam): NormalizedEntity {
  return {
    format: "sport",
    name: team.name,
    provider: "balldontlie-nba",
    externalId: team.externalId,
    coverUrl: null,
    iconUrl: null,
    externalUrl: null,
    metadata: {
      competition: { id: "nba", name: "NBA", sport: "basketball" },
      abbreviation: team.abbreviation,
      conference: team.conference,
      division: team.division,
    },
  };
}
