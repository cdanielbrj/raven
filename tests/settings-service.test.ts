import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsService } from "../src/application/settings/settings-service.js";
import { openDatabase } from "../src/infrastructure/database/database.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("SettingsService", () => {
  it("reports local installation state and persists manual provider checks", async () => {
    const { database, databasePath } = testDatabase();
    let shouldFail = false;
    const service = new SettingsService(
      database,
      databasePath,
      [
        {
          id: "anilist",
          label: "AniList",
          configured: true,
          check: async () => {
            if (shouldFail) throw new Error("offline");
          },
        },
        { id: "mal", label: "MyAnimeList", configured: false },
      ],
      "0.1.0",
    );

    expect(service.getOverview()).toMatchObject({
      installation: { mode: "local-first", version: "0.1.0" },
      database: {
        schemaVersion: 5,
        trackedItems: 0,
        upcomingEvents: 0,
        discoverySnapshots: 0,
      },
      providers: [
        { id: "anilist", status: "not_checked" },
        { id: "mal", status: "not_configured" },
      ],
    });

    await expect(service.checkProvider("anilist")).resolves.toMatchObject({
      providers: [
        { id: "anilist", status: "available" },
        { id: "mal", status: "not_configured" },
      ],
    });

    shouldFail = true;
    const afterFailure = await service.checkProvider("anilist");
    expect(afterFailure.providers[0]).toMatchObject({
      status: "unavailable",
      lastCheckedAt: expect.any(String),
      lastSucceededAt: expect.any(String),
    });
    database.close();
  });
});

function testDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "raven-settings-"));
  directories.push(directory);
  const databasePath = path.join(directory, "raven.db");
  return { database: openDatabase(databasePath), databasePath };
}
