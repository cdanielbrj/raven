import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/api/internal/app.js";
import { DiscoveryService } from "../src/application/discovery/discovery-service.js";
import { SettingsService } from "../src/application/settings/settings-service.js";
import { ProviderRegistry } from "../src/application/tracking/provider-registry.js";
import { SyncCoordinator } from "../src/application/tracking/sync-coordinator.js";
import { TrackingService } from "../src/application/tracking/tracking-service.js";
import { openDatabase } from "../src/infrastructure/database/database.js";
import type { CatalogProvider } from "../src/models/catalog.js";
import type {
  DiscoveryQuery,
  NormalizedEntity,
  NormalizedEvent,
  Provider,
} from "../src/models/provider.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("HTTP contracts", () => {
  it("preserves API status codes and payloads", async () => {
    const app = await testApp();

    const status = await app.inject({ method: "GET", url: "/api/v1/status" });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      application: "raven",
      providerCount: 1,
      sync: "manual",
    });

    const invalidRequest = await app.inject({
      method: "GET",
      url: "/api/v1/discovery/anime?kind=search",
    });
    expect(invalidRequest.statusCode).toBe(400);
    expect(invalidRequest.json()).toEqual({
      error: "invalid_request",
      message: "search is required when kind is search",
    });

    const missingRoute = await app.inject({
      method: "GET",
      url: "/api/v1/not-a-route",
    });
    expect(missingRoute.statusCode).toBe(404);
    expect(missingRoute.json()).toEqual({ error: "not_found" });

    const teams = await app.inject({
      method: "GET",
      url: "/api/v1/sports/nba/teams",
    });
    expect(teams.statusCode).toBe(200);
    expect(teams.json()).toMatchObject({
      items: [
        {
          format: "sport",
          provider: "balldontlie-nba",
          externalId: "2",
        },
      ],
    });

    const follow = await app.inject({
      method: "POST",
      url: "/api/v1/sports/nba/teams/2/follow",
    });
    expect(follow.statusCode).toBe(201);
    expect(follow.json()).toMatchObject({
      entity: { name: "Boston Celtics", format: "sport" },
    });

    const tracking = await app.inject({
      method: "GET",
      url: "/api/v1/sports/nba/tracking",
    });
    expect(tracking.statusCode).toBe(200);
    expect(tracking.json()).toMatchObject({
      items: [{ entity: { name: "Boston Celtics", format: "sport" } }],
    });

    await app.close();
  });

  it("serves the web application for client-side routes", async () => {
    const app = await testApp();

    for (const url of [
      "/anime/upcoming",
      "/sports/nba/teams",
      "/sports/nba/tracking",
      "/settings",
    ]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.body).toContain('<div id="root"></div>');
    }

    await app.close();
  });
});

async function testApp() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "raven-http-"));
  directories.push(directory);
  const databasePath = path.join(directory, "raven.db");
  const webRoot = path.join(directory, "web");
  fs.mkdirSync(webRoot);
  fs.writeFileSync(
    path.join(webRoot, "index.html"),
    '<!doctype html><html><body><div id="root"></div></body></html>',
  );

  const database = openDatabase(databasePath);
  const provider = new FakeAnimeProvider();
  const providers = new ProviderRegistry([provider]);
  const trackingService = new TrackingService(database, providers);

  return createApp({
    database,
    providers,
    discoveryService: new DiscoveryService(database, [
      provider,
      new FakeNbaCatalogProvider(),
    ]),
    settingsService: new SettingsService(
      database,
      databasePath,
      [{ id: provider.id, label: "Test provider", configured: true }],
      "0.1.0",
    ),
    trackingService,
    syncCoordinator: new SyncCoordinator(database, providers, trackingService),
    webRoot,
  });
}

class FakeNbaCatalogProvider implements CatalogProvider {
  readonly id = "balldontlie-nba";
  readonly format = "sport" as const;

  async discover(): Promise<NormalizedEntity[]> {
    return [this.entity];
  }

  async getEntity(): Promise<NormalizedEntity> {
    return this.entity;
  }

  private readonly entity: NormalizedEntity = {
    format: "sport",
    name: "Boston Celtics",
    provider: "balldontlie-nba",
    externalId: "2",
    coverUrl: null,
    iconUrl: null,
    externalUrl: null,
    metadata: {
      abbreviation: "BOS",
      competition: { id: "nba", name: "NBA", sport: "basketball" },
    },
  };
}

class FakeAnimeProvider implements Provider {
  readonly id = "test-anime";
  readonly format = "anime" as const;
  readonly capabilities = {
    discovery: true,
    events: true,
    availability: false,
    covers: false,
    icons: false,
  };
  readonly authentication = { type: "none" as const };
  readonly syncPolicy = { defaultIntervalMs: 1, maxConcurrentSyncs: 1 };

  async discover(_query: DiscoveryQuery): Promise<NormalizedEntity[]> {
    return [];
  }

  async getEntity(_externalId: string): Promise<NormalizedEntity> {
    throw new Error("Not used by HTTP contract tests");
  }

  async getEvents(_entity: NormalizedEntity): Promise<NormalizedEvent[]> {
    return [];
  }
}
