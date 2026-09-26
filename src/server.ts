import { createApp } from "./api/internal/app.js";
import { BallDontLieNbaProvider } from "./api/external/balldontlie/nba-schedule-provider.js";
import { TheSportsDbTeamIdentityProvider } from "./api/external/thesportsdb/team-identity-provider.js";
import { MalCatalogProvider } from "./api/external/mal/mal-catalog-provider.js";
import { DiscoveryService } from "./application/core/discovery/discovery-service.js";
import { loadConfig } from "./infrastructure/config.js";
import { openDatabase } from "./infrastructure/database/database.js";
import { AniListProvider } from "./api/external/anilist/anilist-provider.js";
import { ProviderRegistry } from "./application/core/tracking/provider-registry.js";
import { SyncCoordinator } from "./application/core/tracking/sync-coordinator.js";
import { TrackingService } from "./application/core/tracking/tracking-service.js";
import { SettingsService } from "./application/core/settings/settings-service.js";
import { NbaTeamIdentityService } from "./application/sports/nba/nba-team-identity-service.js";
import { NbaScheduleService } from "./application/sports/nba/nba-schedule-service.js";

const config = loadConfig();
const database = openDatabase(config.databasePath);
const aniListProvider = new AniListProvider();
const malProvider = config.malClientId
  ? new MalCatalogProvider(config.malClientId)
  : undefined;
const ballDontLieNbaProvider = config.ballDontLieApiKey
  ? new BallDontLieNbaProvider(config.ballDontLieApiKey)
  : undefined;
const teamIdentityProvider = new TheSportsDbTeamIdentityProvider(
  config.theSportsDbApiKey,
);
const providers = new ProviderRegistry([aniListProvider]);
const discoveryService = new DiscoveryService(database, [
  aniListProvider,
  ...(malProvider ? [malProvider] : []),
  ...(ballDontLieNbaProvider ? [ballDontLieNbaProvider] : []),
]);
const trackingService = new TrackingService(database, providers);
const nbaScheduleService = ballDontLieNbaProvider
  ? new NbaScheduleService(database, ballDontLieNbaProvider, trackingService)
  : undefined;
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
      {
        id: "balldontlie-nba",
        label: "BALLDONTLIE NBA",
        configured: Boolean(ballDontLieNbaProvider),
        check: ballDontLieNbaProvider
          ? () => ballDontLieNbaProvider.listTeams()
          : undefined,
      },
      {
        id: "thesportsdb",
        label: "TheSportsDB team assets",
        configured: true,
        check: () =>
          teamIdentityProvider.resolveEntity({
            format: "sport",
            name: "Boston Celtics",
            provider: "balldontlie-nba",
            externalId: "2",
            coverUrl: null,
            iconUrl: null,
            externalUrl: null,
            metadata: null,
          }),
      },
    ],
    process.env.npm_package_version ?? "0.1.0",
  ),
  trackingService,
  syncCoordinator: new SyncCoordinator(database, providers, trackingService),
  nbaTeamIdentityService: new NbaTeamIdentityService(
    database,
    teamIdentityProvider,
  ),
  nbaScheduleService,
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
