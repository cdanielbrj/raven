import type { CatalogProvider } from "../../../models/catalog.js";
import {
  ProviderRequestError,
  type DiscoveryQuery,
  type NormalizedEntity,
  type NormalizedEvent,
  type Provider,
} from "../../../models/provider.js";

const v1Endpoint = "https://www.thesportsdb.com/api/v1/json";
const v2Endpoint = "https://www.thesportsdb.com/api/v2/json";
const requestTimeoutMs = 10_000;

export interface FootballLeague {
  externalId: string;
  name: string;
  country: string | null;
  featured?: boolean;
}

export interface FootballCountry {
  id: string;
  name: string;
  leagueCount: number;
  flagUrl: string | null;
}

export interface FootballMatch {
  externalId: string;
  startsAt: string | null;
  startsOn: string | null;
  status: string | null;
  competition: FootballLeague;
  homeTeam: { externalId: string; name: string };
  awayTeam: { externalId: string; name: string };
  externalUrl: string | null;
}

export const defaultFootballLeagues: FootballLeague[] = [
  { externalId: "4328", name: "English Premier League", country: "England" },
  { externalId: "4335", name: "Spanish La Liga", country: "Spain" },
  { externalId: "4331", name: "German Bundesliga", country: "Germany" },
  { externalId: "4332", name: "Italian Serie A", country: "Italy" },
  { externalId: "4334", name: "French Ligue 1", country: "France" },
  { externalId: "4351", name: "Brazilian Serie A", country: "Brazil" },
  { externalId: "4480", name: "UEFA Champions League", country: "Europe" },
  { externalId: "4481", name: "UEFA Europa League", country: "Europe" },
  { externalId: "4725", name: "Copa do Brasil", country: "Brazil" },
];

interface SportsDbTeam {
  idTeam?: string;
  strTeam?: string;
  strLeague?: string;
  idLeague?: string;
  strCountry?: string | null;
  strSport?: string;
  strBadge?: string | null;
  strLogo?: string | null;
  strBanner?: string | null;
}

interface SportsDbLeague {
  idLeague?: string;
  strLeague?: string;
  strCountry?: string | null;
  strSport?: string;
}

interface SportsDbCountry {
  name_en?: string;
  flag_url_32?: string | null;
}

interface SportsDbEvent {
  idEvent?: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  dateEvent?: string | null;
  strTimestamp?: string | null;
  strStatus?: string | null;
  strTime?: string | null;
  strTimeLocal?: string | null;
}

interface JsonPayload {
  countries?: Array<SportsDbCountry | SportsDbLeague> | null;
  list?: SportsDbTeam[] | null;
  teams?: SportsDbTeam[] | null;
  leagues?: SportsDbLeague[] | null;
  schedule?: SportsDbEvent[] | null;
  events?: SportsDbEvent[] | null;
  Message?: string;
}

export type Fetcher = typeof fetch;

/** Central football catalog and competition-calendar adapter for TheSportsDB. */
export class TheSportsDbFootballProvider implements CatalogProvider, Provider {
  readonly id = "thesportsdb-football";
  readonly format = "sport" as const;
  readonly capabilities = {
    discovery: true,
    events: true,
    availability: false,
    covers: true,
    icons: true,
  } as const;
  readonly authentication = { type: "instance" as const };
  readonly syncPolicy = {
    defaultIntervalMs: 15 * 60 * 1000,
    maxConcurrentSyncs: 2,
  };

  constructor(
    private readonly apiKey: string,
    private readonly leagues: FootballLeague[],
    private readonly fetcher: Fetcher = fetch,
    private readonly apiV1Endpoint = v1Endpoint,
    private readonly apiV2Endpoint = v2Endpoint,
  ) {}

  async listFeaturedLeagues(): Promise<FootballLeague[]> {
    const payload = await this.requestV2("list/featured/leagues");
    return (payload.leagues ?? [])
      .filter((league) => league.strSport?.toLocaleLowerCase() === "soccer")
      .filter((league) => league.idLeague && league.strLeague)
      .map((league) => ({
        externalId: league.idLeague as string,
        name: league.strLeague as string,
        country: league.strCountry ?? null,
        featured: true,
      }));
  }

  async discover(query: DiscoveryQuery): Promise<NormalizedEntity[]> {
    return this.discoverForCountries(
      query,
      [
        ...new Set(
          this.leagues.map((league) => normalizeCountry(league.country)),
        ),
      ],
      false,
    );
  }

  async listCountries(): Promise<FootballCountry[]> {
    const payload = await this.requestV1("all_countries.php");
    return (payload.countries ?? [])
      .filter((country): country is SportsDbCountry => "name_en" in country)
      .map((country) => ({
        id: country.name_en as string,
        name: country.name_en as string,
        leagueCount: 0,
        flagUrl: nullableUrl(country.flag_url_32),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async discoverForCountries(
    query: DiscoveryQuery,
    countries?: string[],
    useRemoteLeagueCatalog = true,
  ): Promise<NormalizedEntity[]> {
    const search = query.search?.trim().toLocaleLowerCase();
    const selectedCountries = new Set(
      (
        countries ?? (await this.listCountries()).map((country) => country.id)
      ).map(normalizeCountry),
    );
    const leagues = (
      await Promise.all(
        [...selectedCountries].map((country) =>
          this.listCountryLeagues(country, useRemoteLeagueCatalog),
        ),
      )
    ).flat();
    const teams = (
      await Promise.all(leagues.map((league) => this.listLeagueTeams(league)))
    ).flat();
    return deduplicateTeams(teams).filter(
      (team) => !search || team.name.toLocaleLowerCase().includes(search),
    );
  }

  async listCountryLeagues(
    country: string,
    useRemoteLeagueCatalog = true,
  ): Promise<FootballLeague[]> {
    const configured = this.leagues.filter(
      (league) =>
        normalizeCountry(league.country) === normalizeCountry(country),
    );
    if (!useRemoteLeagueCatalog) return configured;

    const payload = await this.requestV1(
      `search_all_leagues.php?c=${encodeURIComponent(country)}`,
    );
    const remote = (payload.leagues ?? payload.countries ?? [])
      .filter(
        (league): league is SportsDbLeague =>
          "strSport" in league &&
          Boolean(
            league.strSport?.toLocaleLowerCase() === "soccer" &&
              league.idLeague &&
              league.strLeague,
          ),
      )
      .map((league) => ({
        externalId: league.idLeague as string,
        name: league.strLeague as string,
        country,
      }));
    return deduplicateLeagues([...configured, ...remote]);
  }

  async getEntity(externalId: string): Promise<NormalizedEntity> {
    const payload = await this.requestV1(
      `lookupteam.php?id=${encodeURIComponent(externalId)}`,
    );
    const team = payload.teams?.find(
      (candidate) => candidate.idTeam === externalId,
    );
    if (!team?.idTeam || !team.strTeam) {
      throw new ProviderRequestError(
        `TheSportsDB football team ${externalId} was not found`,
        404,
      );
    }
    return normalizeEntity({
      team,
      league: await this.resolveTeamLeague(team),
    });
  }

  async listLeagueTeams(league: FootballLeague): Promise<NormalizedEntity[]> {
    let payload: JsonPayload;
    try {
      payload = await this.requestV2(
        `list/teams/${encodeURIComponent(league.externalId)}`,
      );
    } catch (error) {
      if (
        error instanceof ProviderRequestError &&
        error.message === "No data found"
      ) {
        return [];
      }
      throw error;
    }
    return (payload.list ?? payload.teams ?? [])
      .filter((team) => team.idTeam && team.strTeam)
      .map((team) => normalizeEntity({ team, league }));
  }

  async listNextLeagueMatches(
    league: FootballLeague,
  ): Promise<FootballMatch[]> {
    const payload = await this.requestV2(
      `schedule/next/league/${encodeURIComponent(league.externalId)}`,
    );
    return (payload.schedule ?? payload.events ?? [])
      .filter((event) => event.idEvent && event.idHomeTeam && event.idAwayTeam)
      .map((event) => normalizeMatch(event, league));
  }

  async getEvents(entity: NormalizedEntity): Promise<NormalizedEvent[]> {
    const competition = entity.metadata?.competition as
      | { id?: string }
      | undefined;
    const competitions = Array.isArray(entity.metadata?.competitions)
      ? entity.metadata.competitions
      : competition
        ? [competition]
        : [];
    const leagues = (
      await Promise.all(
        competitions.map(async (item) => {
          const candidate = item as { id?: string; country?: string };
          const configured = this.leagues.find(
            (league) => league.externalId === candidate.id,
          );
          if (configured) return configured;
          const countryLeagues = await this.listCountryLeagues(
            candidate.country ?? "International",
          );
          return countryLeagues.find(
            (league) => league.externalId === candidate.id,
          );
        }),
      )
    ).filter((league): league is FootballLeague => Boolean(league));
    if (leagues.length === 0) return [];

    const matches = [
      ...(
        await Promise.all(
          leagues.map((league) => this.listNextLeagueMatches(league)),
        )
      ).flat(),
    ].filter(
      (match, index, all) =>
        all.findIndex(
          (candidate) => candidate.externalId === match.externalId,
        ) === index,
    );

    return matches
      .filter(
        (match) =>
          match.homeTeam.externalId === entity.externalId ||
          match.awayTeam.externalId === entity.externalId,
      )
      .map((match) => ({
        name: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
        type: "match",
        format: "sport" as const,
        episodeNumber: null,
        startsAt: match.startsAt,
        startsOn: match.startsOn,
        timePrecision: match.startsAt
          ? ("datetime" as const)
          : ("date" as const),
        endsAt: null,
        provider: this.id,
        externalId: match.externalId,
        externalUrl: match.externalUrl,
        source: "TheSportsDB",
        metadata: {
          competition: match.competition,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          status: match.status,
        },
      }));
  }

  private async resolveTeamLeague(team: SportsDbTeam): Promise<FootballLeague> {
    const configured = leagueFromTeam(team, this.leagues);
    if (configured.externalId !== "unknown") return configured;

    const countryLeagues = await this.listCountryLeagues(
      team.strCountry ?? "International",
    );
    return (
      countryLeagues.find(
        (league) =>
          league.externalId === team.idLeague || league.name === team.strLeague,
      ) ?? configured
    );
  }

  private async requestV1(path: string): Promise<JsonPayload> {
    return this.request(
      new URL(`${this.apiKey}/${path}`, `${this.apiV1Endpoint}/`),
    );
  }

  private async requestV2(path: string): Promise<JsonPayload> {
    return this.request(new URL(path, `${this.apiV2Endpoint}/`), {
      "X-API-KEY": this.apiKey,
    });
  }

  private async request(
    url: URL,
    headers?: Record<string, string>,
  ): Promise<JsonPayload> {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers,
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      throw new ProviderRequestError(
        `TheSportsDB request failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as JsonPayload | null;
    if (!response.ok || !payload || payload.Message) {
      throw new ProviderRequestError(
        payload?.Message ??
          `TheSportsDB request failed with HTTP ${response.status}`,
        response.status,
      );
    }
    return payload;
  }
}

function normalizeCountry(country: string | null | undefined): string {
  return country?.trim() || "International";
}

function normalizeEntity(input: {
  team: SportsDbTeam;
  league: FootballLeague;
}): NormalizedEntity {
  return {
    format: "sport",
    name: input.team.strTeam as string,
    provider: "thesportsdb-football",
    externalId: input.team.idTeam as string,
    coverUrl: nullableUrl(input.team.strBanner),
    iconUrl: nullableUrl(input.team.strBadge ?? input.team.strLogo),
    externalUrl: null,
    metadata: {
      competition: {
        id: input.league.externalId,
        name: input.league.name,
        sport: "soccer",
        country: input.league.country,
      },
      assetSource: { provider: "thesportsdb", externalId: input.team.idTeam },
    },
  };
}

function normalizeMatch(
  event: SportsDbEvent,
  league: FootballLeague,
): FootballMatch {
  const timestamp = event.strTimestamp?.trim();
  const date = event.dateEvent?.trim();
  const time = event.strTimeLocal?.trim() || event.strTime?.trim();
  const startsAt = timestamp
    ? new Date(timestamp).toISOString()
    : date && time
      ? new Date(`${date}T${time}Z`).toISOString()
      : null;
  return {
    externalId: event.idEvent as string,
    startsAt: startsAt && !Number.isNaN(Date.parse(startsAt)) ? startsAt : null,
    startsOn: startsAt ? null : date || null,
    status: event.strStatus ?? null,
    competition: league,
    homeTeam: {
      externalId: event.idHomeTeam as string,
      name: event.strHomeTeam ?? "",
    },
    awayTeam: {
      externalId: event.idAwayTeam as string,
      name: event.strAwayTeam ?? "",
    },
    externalUrl: null,
  };
}

function leagueFromTeam(
  team: SportsDbTeam,
  configured: FootballLeague[],
): FootballLeague {
  return (
    configured.find((league) => league.externalId === team.idLeague) ?? {
      externalId: team.idLeague ?? "unknown",
      name: team.strLeague ?? "Football",
      country: team.strCountry ?? null,
    }
  );
}

function deduplicateTeams(teams: NormalizedEntity[]): NormalizedEntity[] {
  const byId = new Map<string, NormalizedEntity>();
  for (const team of teams) {
    const existing = byId.get(team.externalId);
    if (!existing) {
      byId.set(team.externalId, {
        ...team,
        metadata: {
          ...team.metadata,
          competitions: team.metadata?.competition
            ? [team.metadata.competition]
            : [],
        },
      });
      continue;
    }

    const competitions = [
      ...((existing.metadata?.competitions as unknown[]) ?? []),
      team.metadata?.competition,
    ].filter(Boolean);
    byId.set(team.externalId, {
      ...existing,
      metadata: {
        ...existing.metadata,
        competitions: deduplicateCompetitions(competitions),
      },
    });
  }
  return [...byId.values()];
}

function deduplicateLeagues(leagues: FootballLeague[]): FootballLeague[] {
  return [
    ...new Map(leagues.map((league) => [league.externalId, league])).values(),
  ];
}

function deduplicateCompetitions(
  competitions: unknown[],
): Array<Record<string, unknown>> {
  return [
    ...new Map(
      competitions.map((competition) => {
        const item = competition as { id?: string };
        return [item.id ?? JSON.stringify(competition), competition];
      }),
    ).values(),
  ] as Array<Record<string, unknown>>;
}

function nullableUrl(value: string | null | undefined): string | null {
  return value?.trim() || null;
}
