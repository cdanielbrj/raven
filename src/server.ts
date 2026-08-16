import { createApp } from "./api/internal/app.js";
import { loadConfig } from "./infrastructure/config.js";
import { openDatabase } from "./infrastructure/database/database.js";
import { AniListProvider } from "./api/external/anilist/anilist-provider.js";
import { ProviderRegistry } from "./application/tracking/provider-registry.js";
import { SyncCoordinator } from "./application/tracking/sync-coordinator.js";
import { TrackingService } from "./application/tracking/tracking-service.js";

const config = loadConfig();
const database = openDatabase(config.databasePath);
const providers = new ProviderRegistry([new AniListProvider()]);
const trackingService = new TrackingService(database, providers);
const app = await createApp({
  database,
  providers,
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
