import { describe, expect, it } from "vitest";
import {
  TheSportsDbFootballProvider,
  type FootballLeague,
} from "../src/api/external/thesportsdb/football-provider.js";

const serieA: FootballLeague = {
  externalId: "4351",
  name: "Brazilian Serie A",
  country: "Brazil",
};

describe("TheSportsDbFootballProvider", () => {
  it("discovers teams from configured leagues and normalizes assets", async () => {
    const provider = new TheSportsDbFootballProvider(
      "123",
      [serieA],
      async (input, init) => {
        const url = new URL(String(input));
        expect(url.pathname).toBe("/api/v2/json/list/teams/4351");
        expect(init?.headers).toMatchObject({ "X-API-KEY": "123" });
        return response({
          list: [
            {
              idTeam: "134287",
              strTeam: "Flamengo",
              strBadge: "https://assets.example/flamengo.png",
            },
          ],
        });
      },
    );

    await expect(provider.discover({ kind: "current" })).resolves.toEqual([
      expect.objectContaining({
        provider: "thesportsdb-football",
        externalId: "134287",
        name: "Flamengo",
        iconUrl: "https://assets.example/flamengo.png",
        metadata: expect.objectContaining({
          competition: expect.objectContaining({ id: "4351", sport: "soccer" }),
        }),
      }),
    ]);
  });

  it("normalizes competition matches so followed teams can be matched later", async () => {
    const provider = new TheSportsDbFootballProvider(
      "123",
      [serieA],
      async (input, init) => {
        expect(new URL(String(input)).pathname).toBe(
          "/api/v2/json/schedule/next/league/4351",
        );
        expect(init?.headers).toMatchObject({ "X-API-KEY": "123" });
        return response({
          schedule: [
            {
              idEvent: "event-1",
              idHomeTeam: "134287",
              idAwayTeam: "999",
              strHomeTeam: "Flamengo",
              strAwayTeam: "Santos",
              dateEvent: "2026-10-08",
              strLeague: "Brazilian Serie A",
            },
          ],
        });
      },
    );

    await expect(provider.listNextLeagueMatches(serieA)).resolves.toEqual([
      expect.objectContaining({
        externalId: "event-1",
        startsOn: "2026-10-08",
        homeTeam: { externalId: "134287", name: "Flamengo" },
      }),
    ]);
  });

  it("loads teams only from selected countries", async () => {
    const provider = new TheSportsDbFootballProvider(
      "123",
      [
        serieA,
        {
          externalId: "4328",
          name: "English Premier League",
          country: "England",
        },
      ],
      async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("search_all_leagues.php")) {
          expect(url.searchParams.get("c")).toBe("Brazil");
          return response({
            countries: [
              {
                idLeague: "4351",
                strLeague: "Brazilian Serie A",
                strSport: "Soccer",
              },
            ],
          });
        }
        expect(url.pathname).toBe("/api/v2/json/list/teams/4351");
        return response({ list: [] });
      },
    );

    await expect(
      provider.discoverForCountries({ kind: "current" }, ["Brazil"]),
    ).resolves.toEqual([]);
  });

  it("skips a league without a team catalog", async () => {
    const provider = new TheSportsDbFootballProvider(
      "123",
      [
        {
          externalId: "4526",
          name: "Football League Super Cup",
          country: "England",
        },
      ],
      async () => response({ Message: "No data found" }),
    );

    await expect(
      provider.listLeagueTeams({
        externalId: "4526",
        name: "Football League Super Cup",
        country: "England",
      }),
    ).resolves.toEqual([]);
  });
});

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
