import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProviderRegistry } from "../src/application/core/tracking/provider-registry.js";
import type {
  NormalizedEntity,
  NormalizedEvent,
  Provider,
} from "../src/models/provider.js";
import { TrackingService } from "../src/application/core/tracking/tracking-service.js";
import { openDatabase } from "../src/infrastructure/database/database.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("TrackingService", () => {
  it("persists only tracked entities, syncs events, suppresses watched events, and removes all local state on untrack", async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "raven-tracking-test-"),
    );
    temporaryDirectories.push(directory);
    const database = openDatabase(path.join(directory, "raven.db"));
    const provider = new FakeAnimeProvider();
    const service = new TrackingService(
      database,
      new ProviderRegistry([provider]),
    );

    const tracked = await service.track("anime", "100");
    expect(tracked.entity.name).toBe("Example Anime");
    expect(tracked.nextEvent?.episodeNumber).toBe(1);
    expect(tracked.syncStatus).toBe("synced");
    const [timelineEvent] = service.listTimeline(
      undefined,
      new Date(tracked.nextEvent!.startsAt!),
    );
    expect(timelineEvent.entity.metadata).toMatchObject({
      bannerImage: "https://example.test/banner.jpg",
      trailer: { id: "example-trailer", site: "youtube" },
    });
    expect(service.listTimeline("sport")).toEqual([]);

    expect(service.markWatched(tracked.nextEvent!.id)).toBe(true);
    expect(service.listTimeline()).toHaveLength(0);

    await service.track("anime", "100");
    expect(service.listTimeline()).toHaveLength(0);

    expect(service.untrack(tracked.entity.id)).toBe(true);
    expect(service.listTracked()).toEqual([]);
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM dismissed_events").get(),
    ).toEqual({ count: 0 });

    database.close();
  });

  it("reconciles schedules removed by a provider and never exposes past events as next", async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "raven-tracking-test-"),
    );
    temporaryDirectories.push(directory);
    const database = openDatabase(path.join(directory, "raven.db"));
    const provider = new FakeAnimeProvider();
    const service = new TrackingService(
      database,
      new ProviderRegistry([provider]),
    );

    await service.track("anime", "100");
    expect(service.listTracked("anime")[0].nextEvent).not.toBeNull();

    provider.events = [];
    await service.refreshAll("anime");

    expect(service.listTracked("anime")[0].nextEvent).toBeNull();
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM events").get(),
    ).toEqual({ count: 0 });

    database.close();
  });

  it("keeps fallback catalog items locally when no schedule provider is registered", async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "raven-tracking-test-"),
    );
    temporaryDirectories.push(directory);
    const database = openDatabase(path.join(directory, "raven.db"));
    const service = new TrackingService(
      database,
      new ProviderRegistry([new FakeAnimeProvider()]),
    );

    await expect(
      service.trackEntity({
        ...new FakeAnimeProvider().entityForTest(),
        provider: "mal",
        externalId: "52991",
      }),
    ).resolves.toMatchObject({
      entity: { provider: "mal" },
      nextEvent: null,
      syncStatus: "pending",
    });
    database.close();
  });
});

class FakeAnimeProvider implements Provider {
  readonly id = "fake-anime";
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

  async discover(): Promise<NormalizedEntity[]> {
    return [this.entity];
  }

  async getEntity(): Promise<NormalizedEntity> {
    return this.entity;
  }

  events: NormalizedEvent[] = [
    {
      name: null,
      type: "episode",
      format: "anime",
      episodeNumber: 1,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      startsOn: null,
      timePrecision: "datetime",
      endsAt: null,
      provider: "fake-anime",
      externalId: "event-1",
      externalUrl: null,
      source: null,
      metadata: null,
    },
    {
      name: null,
      type: "episode",
      format: "anime",
      episodeNumber: 2,
      startsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      startsOn: null,
      timePrecision: "datetime",
      endsAt: null,
      provider: "fake-anime",
      externalId: "event-2",
      externalUrl: null,
      source: null,
      metadata: null,
    },
  ];

  async getEvents(): Promise<NormalizedEvent[]> {
    return this.events;
  }

  private readonly entity: NormalizedEntity = {
    format: "anime",
    name: "Example Anime",
    provider: "fake-anime",
    externalId: "100",
    coverUrl: null,
    iconUrl: null,
    externalUrl: null,
    metadata: {
      bannerImage: "https://example.test/banner.jpg",
      trailer: { id: "example-trailer", site: "youtube" },
    },
  };

  entityForTest(): NormalizedEntity {
    return this.entity;
  }
}
