import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NbaTeamIdentityService } from "../src/application/sports/nba-team-identity-service.js";
import { openDatabase } from "../src/infrastructure/database/database.js";
import type { EntityAssetProvider } from "../src/models/entity-assets.js";
import type { NormalizedEntity } from "../src/models/provider.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("NbaTeamIdentityService", () => {
  it("returns promptly, then stores resolved badges for the local catalog", async () => {
    const database = testDatabase();
    const service = new NbaTeamIdentityService(
      database,
      new FakeAssetsProvider(),
      0,
    );

    expect(service.enrich([celtics])).toMatchObject({
      items: [{ iconUrl: null }],
      coverage: { status: "syncing", resolved: 0, missing: 1, total: 1 },
    });

    await waitFor(
      () => service.enrich([celtics]).coverage.status === "complete",
    );
    expect(service.enrich([celtics])).toMatchObject({
      items: [{ iconUrl: "https://assets.example/celtics.png" }],
      coverage: { status: "complete", resolved: 1, missing: 0, total: 1 },
    });
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM entity_assets").get(),
    ).toEqual({ count: 1 });
    database.close();
  });
});

class FakeAssetsProvider implements EntityAssetProvider {
  readonly id = "test-assets";

  async resolveEntity() {
    return {
      sourceExternalId: "asset-2",
      iconUrl: "https://assets.example/celtics.png",
      logoUrl: null,
      bannerUrl: null,
    };
  }
}

function testDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "raven-assets-"));
  directories.push(directory);
  return openDatabase(path.join(directory, "raven.db"));
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error("Timed out waiting for local asset cache");
}

const celtics: NormalizedEntity = {
  format: "sport",
  name: "Boston Celtics",
  provider: "balldontlie-nba",
  externalId: "2",
  coverUrl: null,
  iconUrl: null,
  externalUrl: null,
  metadata: { abbreviation: "BOS" },
};
