import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DiscoveryService } from "../src/application/discovery/discovery-service.js";
import { openDatabase } from "../src/infrastructure/database/database.js";
import {
  ProviderRequestError,
  type NormalizedEntity,
} from "../src/models/provider.js";
import type { CatalogProvider } from "../src/models/catalog.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("DiscoveryService", () => {
  it("uses MAL when AniList is unavailable and stores the successful snapshot", async () => {
    const database = testDatabase();
    const service = new DiscoveryService(
      database,
      new FakeCatalogProvider("anilist", new ProviderRequestError("offline")),
      new FakeCatalogProvider("mal", [entity]),
    );

    await expect(
      service.discover("anime", { kind: "current" }),
    ).resolves.toMatchObject({
      source: "mal",
      stale: false,
      items: [entity],
    });
    expect(
      database.prepare("SELECT provider FROM discovery_snapshots").get(),
    ).toEqual({ provider: "mal" });
    database.close();
  });

  it("returns the newest local snapshot when both providers are unavailable", async () => {
    const database = testDatabase();
    const service = new DiscoveryService(
      database,
      new FakeCatalogProvider("anilist", [entity]),
      new FakeCatalogProvider("mal", new ProviderRequestError("offline")),
    );
    await service.discover("anime", { kind: "current" });

    const offline = new DiscoveryService(
      database,
      new FakeCatalogProvider("anilist", new ProviderRequestError("offline")),
      new FakeCatalogProvider("mal", new ProviderRequestError("offline")),
    );
    await expect(
      offline.discover("anime", { kind: "current" }),
    ).resolves.toMatchObject({
      source: "anilist",
      stale: true,
      items: [entity],
    });
    database.close();
  });
});

class FakeCatalogProvider implements CatalogProvider {
  readonly format = "anime" as const;

  constructor(
    readonly id: string,
    private readonly result: NormalizedEntity[] | Error,
  ) {}

  async discover(): Promise<NormalizedEntity[]> {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }

  async getEntity(): Promise<NormalizedEntity> {
    if (this.result instanceof Error) throw this.result;
    return this.result[0];
  }
}

function testDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "raven-discovery-"));
  directories.push(directory);
  return openDatabase(path.join(directory, "raven.db"));
}

const entity: NormalizedEntity = {
  format: "anime",
  name: "Example Anime",
  provider: "anilist",
  externalId: "1",
  coverUrl: null,
  iconUrl: null,
  externalUrl: null,
  metadata: null,
};
