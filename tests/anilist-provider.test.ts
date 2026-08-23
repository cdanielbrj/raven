import { describe, expect, it } from "vitest";
import {
  AniListProvider,
  AniListProviderError,
  type Fetcher,
} from "../src/api/external/anilist/anilist-provider.js";

const media = {
  id: 52991,
  idMal: 52991,
  title: {
    english: "Frieren: Beyond Journey’s End",
    romaji: "Sousou no Frieren",
    native: "葬送のフリーレン",
  },
  siteUrl: "https://anilist.co/anime/52991",
  coverImage: {
    extraLarge: "https://example.test/frieren.jpg",
    large: null,
    medium: null,
  },
  format: "TV",
  status: "RELEASING",
  season: "FALL",
  seasonYear: 2023,
  episodes: 28,
  genres: ["Adventure", "Drama", "Fantasy"],
  startDate: { year: 2023, month: 9, day: 29 },
  bannerImage: "https://example.test/frieren-banner.jpg",
  trailer: {
    id: "trailer-id",
    site: "youtube",
    thumbnail: "https://example.test/trailer.jpg",
  },
  externalLinks: [
    {
      site: "Crunchyroll",
      url: "https://example.test/crunchyroll/frieren",
      icon: "https://example.test/crunchyroll.png",
      color: "#f47521",
      type: "STREAMING",
    },
  ],
  streamingEpisodes: [],
  nextAiringEpisode: { id: 1, airingAt: 1_735_689_600, episode: 8 },
};

describe("AniListProvider", () => {
  it("normalizes search results without leaking AniList fields into the core shape", async () => {
    const fetcher: Fetcher = async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as {
        variables: { sort?: string[]; search: string };
      };
      expect(request.variables.sort).toBeUndefined();
      expect(request.variables.search).toBe("frieren");
      return jsonResponse({ data: { Page: { media: [media] } } });
    };
    const provider = new AniListProvider(fetcher);

    const [entity] = await provider.discover({
      kind: "search",
      search: "frieren",
    });

    expect(entity).toMatchObject({
      format: "anime",
      name: "Frieren: Beyond Journey’s End",
      provider: "anilist",
      externalId: "52991",
      coverUrl: "https://example.test/frieren.jpg",
    });
    expect(entity.metadata).toMatchObject({
      titles: media.title,
      malId: 52991,
      status: "RELEASING",
      genres: ["Adventure", "Drama", "Fantasy"],
      bannerImage: "https://example.test/frieren-banner.jpg",
      trailer: { id: "trailer-id", site: "youtube" },
      availability: {
        site: "Crunchyroll",
        url: "https://example.test/crunchyroll/frieren",
        color: "#f47521",
      },
    });
  });

  it("normalizes every page of future airing events", async () => {
    let calls = 0;
    const fetcher: Fetcher = async () => {
      calls += 1;
      return jsonResponse({
        data: {
          Media: {
            id: 52991,
            airingSchedule: {
              pageInfo: { hasNextPage: calls === 1 },
              nodes: [
                { id: calls, airingAt: 1_735_689_600 + calls, episode: calls },
              ],
            },
          },
        },
      });
    };
    const provider = new AniListProvider(fetcher);
    const entity = {
      format: "anime" as const,
      name: "Frieren",
      provider: "anilist",
      externalId: "52991",
      coverUrl: null,
      iconUrl: null,
      externalUrl: null,
      metadata: null,
    };

    const events = await provider.getEvents(entity);

    expect(calls).toBe(2);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: "episode",
      episodeNumber: 1,
      timePrecision: "datetime",
      externalId: "1",
    });
  });

  it("preserves AniList retry instructions on rate limits", async () => {
    const fetcher: Fetcher = async () =>
      new Response(
        JSON.stringify({
          data: null,
          errors: [{ message: "Too Many Requests." }],
        }),
        {
          status: 429,
          headers: { "retry-after": "30", "content-type": "application/json" },
        },
      );
    const provider = new AniListProvider(fetcher);

    await expect(provider.discover({ kind: "trending" })).rejects.toEqual(
      expect.objectContaining<AniListProviderError>({
        name: "AniListProviderError",
        statusCode: 429,
        retryAfterSeconds: 30,
      }),
    );
  });

  it("keeps next-season discovery strictly chronological by omitting incomplete dates", async () => {
    const fetcher: Fetcher = async () =>
      jsonResponse({
        data: {
          Page: {
            media: [
              { ...media, startDate: { year: 2026, month: 10, day: 4 } },
              {
                ...media,
                id: 999,
                startDate: { year: 2026, month: 10, day: null },
              },
            ],
          },
        },
      });
    const provider = new AniListProvider(fetcher);

    const items = await provider.discover({ kind: "nextSeason" });

    expect(items).toHaveLength(1);
    expect(items[0].externalId).toBe("52991");
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
