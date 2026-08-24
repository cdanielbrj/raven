import { describe, expect, it } from "vitest";
import { TheSportsDbTeamIdentityProvider } from "../src/api/external/thesportsdb/team-identity-provider.js";
import type { NormalizedEntity } from "../src/models/provider.js";

const celtics: NormalizedEntity = {
  format: "sport",
  name: "Boston Celtics",
  provider: "balldontlie-nba",
  externalId: "2",
  coverUrl: null,
  iconUrl: null,
  externalUrl: null,
  metadata: null,
};

describe("TheSportsDbTeamIdentityProvider", () => {
  it("resolves an exact NBA team into display-only identity assets", async () => {
    const provider = new TheSportsDbTeamIdentityProvider(
      "123",
      async (input) => {
        const url = new URL(String(input));
        expect(url.pathname).toBe("/api/v1/json/123/searchteams.php");
        expect(url.searchParams.get("t")).toBe("Boston Celtics");
        return response({
          teams: [
            {
              idTeam: "134860",
              strTeam: "Boston Celtics",
              strLeague: "NBA",
              strBadge: "https://assets.example/celtics-badge.png",
              strLogo: "https://assets.example/celtics-logo.png",
              strBanner: "https://assets.example/celtics-banner.jpg",
            },
          ],
        });
      },
    );

    await expect(provider.resolveEntity(celtics)).resolves.toEqual({
      sourceExternalId: "134860",
      iconUrl: "https://assets.example/celtics-badge.png",
      logoUrl: "https://assets.example/celtics-logo.png",
      bannerUrl: "https://assets.example/celtics-banner.jpg",
    });
  });

  it("does not use an approximate or another-league match", async () => {
    const provider = new TheSportsDbTeamIdentityProvider("123", async () =>
      response({
        teams: [
          { idTeam: "1", strTeam: "Celtics", strLeague: "NBA" },
          { idTeam: "2", strTeam: "Boston Celtics", strLeague: "WNBA" },
        ],
      }),
    );

    await expect(provider.resolveEntity(celtics)).resolves.toBeNull();
  });

  it("expands the conventional LA abbreviation before an exact match", async () => {
    const provider = new TheSportsDbTeamIdentityProvider(
      "123",
      async (input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("t")).toBe("Los Angeles Clippers");
        return response({
          teams: [
            {
              idTeam: "134866",
              strTeam: "Los Angeles Clippers",
              strLeague: "NBA",
              strBadge: "https://assets.example/clippers.png",
            },
          ],
        });
      },
    );

    await expect(
      provider.resolveEntity({ ...celtics, name: "LA Clippers" }),
    ).resolves.toMatchObject({
      sourceExternalId: "134866",
      iconUrl: "https://assets.example/clippers.png",
    });
  });
});

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
