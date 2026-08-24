import type {
  EntityAssetProvider,
  ResolvedEntityAssets,
} from "../../../models/entity-assets.js";
import {
  ProviderRequestError,
  type NormalizedEntity,
} from "../../../models/provider.js";

const endpoint = "https://www.thesportsdb.com/api/v1/json";
const requestTimeoutMs = 10_000;

interface SportsDbTeam {
  idTeam?: string;
  strTeam?: string;
  strLeague?: string;
  strBadge?: string | null;
  strLogo?: string | null;
  strBanner?: string | null;
}

interface SportsDbResponse {
  teams?: SportsDbTeam[] | null;
}

export type Fetcher = typeof fetch;

/**
 * Visual-identity adapter only. It is intentionally not part of the NBA
 * schedule provider, since artwork can be sourced differently per sport.
 */
export class TheSportsDbTeamIdentityProvider implements EntityAssetProvider {
  readonly id = "thesportsdb";

  constructor(
    private readonly apiKey = "123",
    private readonly fetcher: Fetcher = fetch,
    private readonly apiEndpoint = endpoint,
  ) {}

  async resolveEntity(
    entity: NormalizedEntity,
  ): Promise<ResolvedEntityAssets | null> {
    const url = new URL(
      `${this.apiKey}/searchteams.php`,
      `${this.apiEndpoint}/`,
    );
    const acceptedNames = new Set(
      [entity.name, expandCommonTeamAbbreviation(entity.name)].map(
        normalizeName,
      ),
    );
    url.searchParams.set("t", expandCommonTeamAbbreviation(entity.name));

    let response: Response;
    try {
      response = await this.fetcher(url, {
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      throw new ProviderRequestError(
        `TheSportsDB request failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as SportsDbResponse | null;
    if (!response.ok || !payload) {
      throw new ProviderRequestError(
        `TheSportsDB request failed with HTTP ${response.status}`,
        response.status,
      );
    }

    const team = payload.teams?.find(
      (candidate) =>
        candidate.strLeague === "NBA" &&
        acceptedNames.has(normalizeName(candidate.strTeam)),
    );
    if (!team) return null;

    return {
      sourceExternalId: team.idTeam ?? null,
      iconUrl: nullableUrl(team.strBadge),
      logoUrl: nullableUrl(team.strLogo),
      bannerUrl: nullableUrl(team.strBanner),
    };
  }
}

function normalizeName(value: string | undefined): string {
  return (value ?? "").toLocaleLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function expandCommonTeamAbbreviation(value: string): string {
  return value.startsWith("LA ") ? `Los Angeles ${value.slice(3)}` : value;
}

function nullableUrl(value: string | null | undefined): string | null {
  return value?.trim() || null;
}
