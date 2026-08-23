import {
  ProviderRequestError,
  type DiscoveryQuery,
  type NormalizedEntity,
  type NormalizedEvent,
  type Provider,
} from "../../../models/provider.js";

const endpoint = "https://graphql.anilist.co";
const requestTimeoutMs = 10_000;

type DiscoveryKind = NonNullable<DiscoveryQuery["kind"]>;

interface AniListTitle {
  english: string | null;
  romaji: string | null;
  native: string | null;
}

interface AniListMedia {
  id: number;
  idMal: number | null;
  title: AniListTitle;
  siteUrl: string | null;
  coverImage: {
    extraLarge: string | null;
    large: string | null;
    medium: string | null;
  } | null;
  format: string | null;
  status: string | null;
  season: string | null;
  seasonYear: number | null;
  episodes: number | null;
  genres: string[];
  startDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  } | null;
  bannerImage: string | null;
  trailer: {
    id: string | null;
    site: string | null;
    thumbnail: string | null;
  } | null;
  externalLinks: AniListExternalLink[];
  streamingEpisodes: AniListStreamingEpisode[];
  nextAiringEpisode: {
    id: number;
    airingAt: number;
    episode: number;
  } | null;
}

interface AniListExternalLink {
  site: string;
  url: string | null;
  icon: string | null;
  color: string | null;
  type: string | null;
}

interface AniListStreamingEpisode {
  site: string | null;
  url: string | null;
}

interface AniListAiringSchedule {
  id: number;
  airingAt: number;
  episode: number;
}

interface GraphQlError {
  message: string;
  status?: number;
}

interface GraphQlResponse<T> {
  data?: T;
  errors?: GraphQlError[];
}

export class AniListProviderError extends ProviderRequestError {
  constructor(
    message: string,
    statusCode?: number,
    retryAfterSeconds?: number,
  ) {
    super(message, statusCode, retryAfterSeconds);
    this.name = "AniListProviderError";
  }
}

export type Fetcher = typeof fetch;

export class AniListProvider implements Provider {
  readonly id = "anilist";
  readonly format = "anime" as const;
  readonly capabilities = {
    discovery: true,
    events: true,
    availability: true,
    covers: true,
    icons: false,
  };
  readonly authentication = { type: "none" as const };
  readonly syncPolicy = {
    defaultIntervalMs: 6 * 60 * 60 * 1000,
    maxConcurrentSyncs: 1,
  };

  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly apiEndpoint = endpoint,
  ) {}

  async discover(query: DiscoveryQuery): Promise<NormalizedEntity[]> {
    const kind = query.kind ?? "search";
    const search = query.search?.trim();

    if (kind === "search" && !search) {
      throw new AniListProviderError(
        "A search query is required for AniList discovery",
      );
    }

    const { season, year } = currentAniListSeason();
    const variables = discoveryVariables(
      kind,
      search,
      query.page ?? 1,
      season,
      year,
    );
    const result = await this.query<{ Page: { media: AniListMedia[] } }>(
      DISCOVERY_QUERY,
      variables,
    );

    const media =
      kind === "nextSeason"
        ? result.Page.media.filter(hasCompleteStartDate)
        : result.Page.media;
    return media.map(normalizeEntity);
  }

  async getEntity(externalId: string): Promise<NormalizedEntity> {
    const id = parseExternalId(externalId);
    const result = await this.query<{ Media: AniListMedia | null }>(
      MEDIA_QUERY,
      { id },
    );

    if (!result.Media) {
      throw new AniListProviderError(
        `AniList anime ${externalId} was not found`,
        404,
      );
    }

    return normalizeEntity(result.Media);
  }

  async getEvents(entity: NormalizedEntity): Promise<NormalizedEvent[]> {
    const mediaId = parseExternalId(entity.externalId);
    const schedules: AniListAiringSchedule[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const result = await this.query<{
        Media: {
          id: number;
          airingSchedule: {
            pageInfo: { hasNextPage: boolean };
            nodes: AniListAiringSchedule[];
          } | null;
        } | null;
      }>(AIRING_SCHEDULE_QUERY, { id: mediaId, page, perPage: 50 });

      if (!result.Media) {
        throw new AniListProviderError(
          `AniList anime ${entity.externalId} was not found`,
          404,
        );
      }

      const schedule = result.Media.airingSchedule;
      schedules.push(...(schedule?.nodes ?? []));
      hasNextPage = schedule?.pageInfo.hasNextPage ?? false;
      page += 1;
    }

    return schedules.map((schedule) => normalizeEvent(schedule));
  }

  private async query<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    let response: Response;

    try {
      response = await this.fetcher(this.apiEndpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      throw new AniListProviderError(
        `AniList request failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    const payload = (await response
      .json()
      .catch(() => null)) as GraphQlResponse<T> | null;

    if (!response.ok || !payload?.data || payload.errors?.length) {
      const message =
        payload?.errors?.map((item) => item.message).join("; ") ??
        `AniList request failed with HTTP ${response.status}`;
      throw new AniListProviderError(message, response.status, retryAfter);
    }

    return payload.data;
  }
}

function discoveryVariables(
  kind: DiscoveryKind,
  search: string | undefined,
  page: number,
  season: string,
  seasonYear: number,
): Record<string, unknown> {
  const base = { page, perPage: 20 };

  switch (kind) {
    case "search":
      // AniList already ranks a text search by relevance. Supplying SEARCH_MATCH
      // alongside the broader discovery filters can yield an empty page.
      return { ...base, search };
    case "current":
      return {
        ...base,
        season,
        seasonYear,
        status: "RELEASING",
        sort: ["POPULARITY_DESC"],
      };
    case "nextSeason": {
      const next = nextAniListSeason(season, seasonYear);
      return {
        ...base,
        season: next.season,
        seasonYear: next.year,
        status: "NOT_YET_RELEASED",
        startDateGreater: todayAsFuzzyDate(),
        sort: ["START_DATE"],
      };
    }
  }
}

function currentAniListSeason(date = new Date()): {
  season: string;
  year: number;
} {
  const month = date.getUTCMonth() + 1;
  if (month <= 3) return { season: "WINTER", year: date.getUTCFullYear() };
  if (month <= 6) return { season: "SPRING", year: date.getUTCFullYear() };
  if (month <= 9) return { season: "SUMMER", year: date.getUTCFullYear() };
  return { season: "FALL", year: date.getUTCFullYear() };
}

function nextAniListSeason(
  season: string,
  year: number,
): { season: string; year: number } {
  if (season === "WINTER") return { season: "SPRING", year };
  if (season === "SPRING") return { season: "SUMMER", year };
  if (season === "SUMMER") return { season: "FALL", year };
  return { season: "WINTER", year: year + 1 };
}

function todayAsFuzzyDate(date = new Date()): number {
  return (
    date.getUTCFullYear() * 10_000 +
    (date.getUTCMonth() + 1) * 100 +
    date.getUTCDate()
  );
}

function hasCompleteStartDate(media: AniListMedia): boolean {
  return (
    media.startDate?.year !== null &&
    media.startDate?.year !== undefined &&
    media.startDate.month !== null &&
    media.startDate.day !== null
  );
}

function normalizeEntity(media: AniListMedia): NormalizedEntity {
  const name = media.title.english ?? media.title.romaji ?? media.title.native;
  if (!name) {
    throw new AniListProviderError(
      `AniList anime ${media.id} has no usable title`,
    );
  }

  return {
    format: "anime",
    name,
    provider: "anilist",
    externalId: String(media.id),
    coverUrl:
      media.coverImage?.extraLarge ??
      media.coverImage?.large ??
      media.coverImage?.medium ??
      null,
    iconUrl: null,
    externalUrl: media.siteUrl,
    metadata: {
      titles: media.title,
      malId: media.idMal,
      format: media.format,
      status: media.status,
      season: media.season,
      seasonYear: media.seasonYear,
      episodes: media.episodes,
      genres: media.genres,
      startDate: media.startDate,
      bannerImage: media.bannerImage,
      trailer: media.trailer,
      availability: selectAvailability(media),
      nextAiringEpisode: media.nextAiringEpisode,
    },
  };
}

function selectAvailability(media: AniListMedia): {
  site: string;
  url: string;
  icon: string | null;
  color: string | null;
} | null {
  const external = media.externalLinks.find(
    (link) => link.type === "STREAMING" && link.url,
  );
  if (external?.url)
    return {
      site: external.site,
      url: external.url,
      icon: external.icon,
      color: external.color,
    };

  const episode = media.streamingEpisodes.find((item) => item.site && item.url);
  return episode?.site && episode.url
    ? { site: episode.site, url: episode.url, icon: null, color: null }
    : null;
}

function normalizeEvent(schedule: AniListAiringSchedule): NormalizedEvent {
  return {
    name: null,
    type: "episode",
    format: "anime",
    episodeNumber: schedule.episode,
    startsAt: new Date(schedule.airingAt * 1000).toISOString(),
    startsOn: null,
    timePrecision: "datetime",
    endsAt: null,
    provider: "anilist",
    externalId: String(schedule.id),
    externalUrl: null,
    source: null,
    metadata: { airingScheduleId: schedule.id },
  };
}

function parseExternalId(externalId: string): number {
  const id = Number(externalId);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new AniListProviderError(
      `Invalid AniList external ID: ${externalId}`,
    );
  }
  return id;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

const MEDIA_FIELDS = `
  id
  idMal
  title { english romaji native }
  siteUrl
  coverImage { extraLarge large medium }
  format
  status
  season
  seasonYear
  episodes
  genres
  startDate { year month day }
  bannerImage
  trailer { id site thumbnail }
  externalLinks { site url icon color type }
  streamingEpisodes { site url }
  nextAiringEpisode { id airingAt episode }
`;

const DISCOVERY_QUERY = `
  query Discovery(
    $page: Int!
    $perPage: Int!
    $search: String
    $season: MediaSeason
    $seasonYear: Int
    $status: MediaStatus
    $startDateGreater: FuzzyDateInt
    $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: $perPage) {
      media(
        type: ANIME
        isAdult: false
        search: $search
        season: $season
        seasonYear: $seasonYear
        status: $status
        startDate_greater: $startDateGreater
        sort: $sort
      ) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

const MEDIA_QUERY = `
  query Media($id: Int!) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_FIELDS}
    }
  }
`;

const AIRING_SCHEDULE_QUERY = `
  query AiringSchedule($id: Int!, $page: Int!, $perPage: Int!) {
    Media(id: $id, type: ANIME) {
      id
      airingSchedule(notYetAired: true, page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        nodes { id airingAt episode }
      }
    }
  }
`;
