import { describe, expect, it } from "vitest";
import {
  BallDontLieNbaProvider,
  BallDontLieNbaProviderError,
  type Fetcher,
} from "../src/api/external/balldontlie/nba-schedule-provider.js";

const celtics = {
  id: 2,
  conference: "East",
  division: "Atlantic",
  city: "Boston",
  name: "Celtics",
  full_name: "Boston Celtics",
  abbreviation: "BOS",
};

describe("BallDontLieNbaProvider", () => {
  it("normalizes the team catalog using the instance API credential", async () => {
    const provider = new BallDontLieNbaProvider(
      "api-key",
      async (input, init) => {
        const url = new URL(String(input));
        expect(url.pathname).toBe("/v1/teams");
        expect(init?.headers).toMatchObject({ Authorization: "api-key" });
        return jsonResponse({ data: [celtics] });
      },
    );

    await expect(provider.listTeams()).resolves.toEqual([
      {
        externalId: "2",
        name: "Boston Celtics",
        abbreviation: "BOS",
        conference: "East",
        division: "Atlantic",
      },
    ]);
  });

  it("limits discovery to current NBA franchises and supports team search", async () => {
    const provider = new BallDontLieNbaProvider("api-key", async () =>
      jsonResponse({
        data: [celtics, { ...celtics, id: 31, full_name: "Legacy Franchise" }],
      }),
    );

    await expect(
      provider.discover({ kind: "search", search: "boston" }),
    ).resolves.toEqual([
      expect.objectContaining({
        format: "sport",
        provider: "balldontlie-nba",
        externalId: "2",
        name: "Boston Celtics",
        metadata: expect.objectContaining({
          competition: { id: "nba", name: "NBA", sport: "basketball" },
          conference: "East",
        }),
      }),
    ]);
  });

  it("retrieves and normalizes every page of a season schedule", async () => {
    const requests: URL[] = [];
    const fetcher: Fetcher = async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      const cursor = url.searchParams.get("cursor");
      return jsonResponse(
        cursor
          ? { data: [game(2, "2026-10-22T23:00:00.000Z")] }
          : {
              data: [game(1, "2026-10-20T19:00:00.000Z")],
              meta: { next_cursor: 100 },
            },
      );
    };
    const provider = new BallDontLieNbaProvider("api-key", fetcher);

    const games = await provider.listSeasonGames(2026, ["2", "14"]);

    expect(requests).toHaveLength(2);
    expect(requests[0].pathname).toBe("/v1/games");
    expect(requests[0].searchParams.get("seasons[]")).toBe("2026");
    expect(requests[0].searchParams.getAll("team_ids[]")).toEqual(["2", "14"]);
    expect(requests[0].searchParams.get("per_page")).toBe("100");
    expect(requests[1].searchParams.get("cursor")).toBe("100");
    expect(games).toEqual([
      expect.objectContaining({
        externalId: "1",
        startsAt: "2026-10-20T19:00:00.000Z",
        status: "scheduled",
        homeTeam: expect.objectContaining({ name: "Boston Celtics" }),
        awayTeam: expect.objectContaining({ name: "Los Angeles Lakers" }),
      }),
      expect.objectContaining({ externalId: "2" }),
    ]);
  });

  it("preserves provider failures for Raven's health and retry handling", async () => {
    const provider = new BallDontLieNbaProvider(
      "api-key",
      async () =>
        new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
    );

    await expect(provider.listTeams()).rejects.toEqual(
      expect.objectContaining<BallDontLieNbaProviderError>({
        name: "BallDontLieNbaProviderError",
        statusCode: 429,
      }),
    );
  });
});

function game(id: number, datetime: string) {
  return {
    id,
    date: datetime.slice(0, 10),
    datetime,
    season: 2026,
    status_state: "scheduled",
    postponed: false,
    postseason: false,
    home_team: celtics,
    visitor_team: {
      id: 14,
      conference: "West",
      division: "Pacific",
      city: "Los Angeles",
      name: "Lakers",
      full_name: "Los Angeles Lakers",
      abbreviation: "LAL",
    },
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
