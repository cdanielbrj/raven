import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BallDontLieNbaProvider } from "../src/api/external/balldontlie/nba-schedule-provider.js";
import { NbaScheduleService } from "../src/application/sports/nba/nba-schedule-service.js";
import { ProviderRegistry } from "../src/application/core/tracking/provider-registry.js";
import { TrackingService } from "../src/application/core/tracking/tracking-service.js";
import { openDatabase } from "../src/infrastructure/database/database.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("NbaScheduleService", () => {
  it("persists games only for followed teams and lists each game once", async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "raven-nba-schedule-test-"),
    );
    temporaryDirectories.push(directory);
    const database = openDatabase(path.join(directory, "raven.db"));
    const tracking = new TrackingService(database, new ProviderRegistry([]));
    await tracking.trackEntity(team("2", "Boston Celtics", "BOS"));
    await tracking.trackEntity(team("14", "Los Angeles Lakers", "LAL"));

    const requestedUrls: URL[] = [];
    const provider = new BallDontLieNbaProvider("api-key", async (input) => {
      const url = new URL(String(input));
      requestedUrls.push(url);
      return jsonResponse({
        data: [
          game(
            1,
            teamData(2, "Boston Celtics", "BOS"),
            teamData(14, "Los Angeles Lakers", "LAL"),
          ),
          game(
            2,
            teamData(2, "Boston Celtics", "BOS"),
            teamData(4, "Chicago Bulls", "CHI"),
          ),
          game(
            3,
            teamData(4, "Chicago Bulls", "CHI"),
            teamData(5, "New York Knicks", "NYK"),
          ),
        ],
      });
    });
    const schedule = new NbaScheduleService(
      database,
      provider,
      tracking,
      () => new Date("2026-10-01T12:00:00.000Z"),
    );

    await expect(schedule.refresh()).resolves.toEqual({ refreshed: 2 });
    expect(requestedUrls[0].searchParams.get("seasons[]")).toBe("2026");
    expect(requestedUrls[0].searchParams.getAll("team_ids[]")).toEqual([
      "14",
      "2",
    ]);
    expect(
      schedule
        .listUpcoming(new Date("2026-10-01T12:00:00.000Z"))
        .map((event) => event.name),
    ).toEqual([
      "Los Angeles Lakers at Boston Celtics",
      "Chicago Bulls at Boston Celtics",
    ]);
    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'game'")
        .get(),
    ).toEqual({ count: 2 });
    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM event_participants")
        .get(),
    ).toEqual({ count: 4 });

    database.close();
  });
});

function team(externalId: string, name: string, abbreviation: string) {
  return {
    format: "sport" as const,
    name,
    provider: "balldontlie-nba",
    externalId,
    coverUrl: null,
    iconUrl: null,
    externalUrl: null,
    metadata: {
      competition: { id: "nba", name: "NBA", sport: "basketball" },
      abbreviation,
    },
  };
}

function teamData(id: number, fullName: string, abbreviation: string) {
  const [city, ...nameParts] = fullName.split(" ");
  return {
    id,
    conference: "East",
    division: "Atlantic",
    city,
    name: nameParts.join(" "),
    full_name: fullName,
    abbreviation,
  };
}

function game(
  id: number,
  homeTeam: ReturnType<typeof teamData>,
  awayTeam: ReturnType<typeof teamData>,
) {
  return {
    id,
    date: "2026-10-01",
    datetime: "2026-10-01T19:00:00.000Z",
    season: 2026,
    status_state: "scheduled",
    postponed: false,
    postseason: false,
    home_team: homeTeam,
    visitor_team: awayTeam,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
