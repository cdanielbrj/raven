import {
  ProviderRequestError,
  type DiscoveryQuery,
  type NormalizedEntity,
} from "../../../models/provider.js";
import type { CatalogProvider } from "../../../models/catalog.js";

const endpoint = "https://api.myanimelist.net/v2";
const requestTimeoutMs = 10_000;

interface MalAnime {
  id: number;
  title: string;
  main_picture?: { medium?: string; large?: string };
  alternative_titles?: {
    synonyms?: string[];
    en?: string;
    ja?: string;
  };
  start_date?: string;
  status?: string;
  media_type?: string;
  num_episodes?: number;
  genres?: Array<{ id: number; name: string }>;
}

interface MalResponse {
  data: Array<{ node: MalAnime }>;
}

export class MalCatalogProviderError extends ProviderRequestError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode);
    this.name = "MalCatalogProviderError";
  }
}

export class MalCatalogProvider implements CatalogProvider {
  readonly id = "mal";
  readonly format = "anime" as const;

  constructor(
    private readonly clientId: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly apiEndpoint = endpoint,
  ) {}

  async discover(query: DiscoveryQuery): Promise<NormalizedEntity[]> {
    const kind = query.kind ?? "search";
    const { path, parameters } = malDiscoveryRequest(kind, query);
    const url = new URL(`${this.apiEndpoint}${path}`);
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: {
          accept: "application/json",
          "X-MAL-CLIENT-ID": this.clientId,
        },
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      throw new MalCatalogProviderError(
        `MAL request failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as MalResponse | null;
    if (!response.ok || !payload?.data) {
      throw new MalCatalogProviderError(
        `MAL request failed with HTTP ${response.status}`,
        response.status,
      );
    }

    const items = payload.data.map(({ node }) => normalizeEntity(node));
    if (kind === "current") {
      return items.filter(
        (item) => item.metadata?.status === "currently_airing",
      );
    }
    if (kind === "nextSeason") {
      return items.filter(
        (item) =>
          item.metadata?.status === "not_yet_aired" &&
          hasCompleteStartDate(item.metadata?.startDate),
      );
    }
    return items;
  }

  async getEntity(externalId: string): Promise<NormalizedEntity> {
    const id = Number(externalId);
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new MalCatalogProviderError(
        "MAL id must be a positive integer",
        404,
      );
    }
    const url = new URL(`${this.apiEndpoint}/anime/${id}`);
    url.searchParams.set(
      "fields",
      "id,title,main_picture,alternative_titles,start_date,status,media_type,num_episodes,genres",
    );
    const response = await this.request(url);
    const payload = (await response
      .json()
      .catch(() => null)) as MalAnime | null;
    if (!payload?.id) {
      throw new MalCatalogProviderError(`MAL anime ${id} was not found`, 404);
    }
    return normalizeEntity(payload);
  }

  private async request(url: URL): Promise<Response> {
    try {
      const response = await this.fetcher(url, {
        headers: {
          accept: "application/json",
          "X-MAL-CLIENT-ID": this.clientId,
        },
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (response.ok) return response;
      throw new MalCatalogProviderError(
        `MAL request failed with HTTP ${response.status}`,
        response.status,
      );
    } catch (error) {
      if (error instanceof MalCatalogProviderError) throw error;
      throw new MalCatalogProviderError(
        `MAL request failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
}

function malDiscoveryRequest(
  kind: NonNullable<DiscoveryQuery["kind"]>,
  query: DiscoveryQuery,
): { path: string; parameters: Record<string, string | undefined> } {
  const page = query.page ?? 1;
  const offset = String((page - 1) * 20);
  const fields =
    "id,title,main_picture,alternative_titles,start_date,status,media_type,num_episodes,genres";
  if (kind === "search") {
    if (!query.search?.trim()) {
      throw new MalCatalogProviderError(
        "A search query is required for MAL discovery",
      );
    }
    return {
      path: "/anime",
      parameters: { q: query.search.trim(), limit: "20", offset, fields },
    };
  }

  const season =
    kind === "current" ? currentSeason() : nextSeason(currentSeason());
  return {
    path: `/anime/season/${season.year}/${season.name}`,
    parameters: { limit: "20", offset, fields },
  };
}

function currentSeason(date = new Date()): { year: number; name: string } {
  const month = date.getUTCMonth() + 1;
  if (month <= 3) return { year: date.getUTCFullYear(), name: "winter" };
  if (month <= 6) return { year: date.getUTCFullYear(), name: "spring" };
  if (month <= 9) return { year: date.getUTCFullYear(), name: "summer" };
  return { year: date.getUTCFullYear(), name: "fall" };
}

function nextSeason(current: { year: number; name: string }): {
  year: number;
  name: string;
} {
  if (current.name === "winter") return { ...current, name: "spring" };
  if (current.name === "spring") return { ...current, name: "summer" };
  if (current.name === "summer") return { ...current, name: "fall" };
  return { year: current.year + 1, name: "winter" };
}

function normalizeEntity(anime: MalAnime): NormalizedEntity {
  return {
    format: "anime",
    name: anime.alternative_titles?.en ?? anime.title,
    provider: "mal",
    externalId: String(anime.id),
    coverUrl: anime.main_picture?.large ?? anime.main_picture?.medium ?? null,
    iconUrl: null,
    externalUrl: `https://myanimelist.net/anime/${anime.id}`,
    metadata: {
      titles: {
        english: anime.alternative_titles?.en ?? null,
        romaji: anime.title,
        native: anime.alternative_titles?.ja ?? null,
      },
      status: anime.status ?? null,
      format: anime.media_type ?? null,
      episodes: anime.num_episodes ?? null,
      genres: anime.genres?.map((genre) => genre.name) ?? [],
      startDate: toStartDate(anime.start_date),
      malId: anime.id,
    },
  };
}

function toStartDate(value: string | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return { year: year || null, month: month || null, day: day || null };
}

function hasCompleteStartDate(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const date = value as { year?: unknown; month?: unknown; day?: unknown };
  return Boolean(date.year && date.month && date.day);
}
