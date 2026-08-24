import { createApp } from "./api/internal/app.js";
import { MalCatalogProvider } from "./api/external/mal/mal-catalog-provider.js";
import { DiscoveryService } from "./application/discovery/discovery-service.js";
import { loadConfig } from "./infrastructure/config.js";
import { openDatabase } from "./infrastructure/database/database.js";
import { AniListProvider } from "./api/external/anilist/anilist-provider.js";
import { ProviderRegistry } from "./application/tracking/provider-registry.js";
import { SyncCoordinator } from "./application/tracking/sync-coordinator.js";
import { TrackingService } from "./application/tracking/tracking-service.js";
import { SettingsService } from "./application/settings/settings-service.js";

const config = loadConfig();
const database = openDatabase(config.databasePath);
const aniListProvider = new AniListProvider();
const malProvider = config.malClientId
  ? new MalCatalogProvider(config.malClientId)
  : undefined;
const providers = new ProviderRegistry([aniListProvider]);
const discoveryService = new DiscoveryService(
  database,
  aniListProvider,
  malProvider,
);
const trackingService = new TrackingService(database, providers);
const app = await createApp({
  database,
  providers,
  discoveryService,
  settingsService: new SettingsService(
    database,
    config.databasePath,
    [
      {
        id: "anilist",
        label: "AniList",
        configured: true,
        check: () => aniListProvider.discover({ kind: "current", page: 1 }),
      },
      {
        id: "mal",
        label: "MyAnimeList",
        configured: Boolean(malProvider),
        check: malProvider
          ? () => malProvider.discover({ kind: "current", page: 1 })
          : undefined,
      },
    ],
    process.env.npm_package_version ?? "0.1.0",
  ),
  trackingService,
  syncCoordinator: new SyncCoordinator(database, providers, trackingService),
});

const close = async (signal: string): Promise<void> => {
  app.log.info({ signal }, "shutting down Raven");
  await app.close();
  process.exit(0);
};

process.once("SIGINT", () => void close("SIGINT"));
process.once("SIGTERM", () => void close("SIGTERM"));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error, "failed to start Raven");
  await app.close();
  process.exit(1);
}
