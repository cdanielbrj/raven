import path from "node:path";
import fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type Database from "better-sqlite3";
import { formats, type Format } from "../../models/media.js";
import {
  ProviderNotRegisteredError,
  ProviderRegistry,
} from "../../application/tracking/provider-registry.js";
import { ProviderRequestError } from "../../models/provider.js";
import { SyncCoordinator } from "../../application/tracking/sync-coordinator.js";
import { TrackingService } from "../../application/tracking/tracking-service.js";
import { DiscoveryService } from "../../application/discovery/discovery-service.js";
import { NbaTeamIdentityService } from "../../application/sports/nba-team-identity-service.js";
import {
  ProviderHealthTargetNotFoundError,
  SettingsService,
} from "../../application/settings/settings-service.js";
import { InvalidRequestError } from "./request-validation.js";

interface AppDependencies {
  database: Database.Database;
  providers: ProviderRegistry;
  discoveryService: DiscoveryService;
  settingsService: SettingsService;
  trackingService: TrackingService;
  syncCoordinator: SyncCoordinator;
  nbaTeamIdentityService?: NbaTeamIdentityService;
  webRoot?: string;
}

export async function createApp({
  database,
  providers,
  discoveryService,
  settingsService,
  trackingService,
  syncCoordinator,
  nbaTeamIdentityService,
  webRoot: configuredWebRoot,
}: AppDependencies): Promise<FastifyInstance> {
  const app = fastify({ logger: true });
  const webRoot = configuredWebRoot ?? path.resolve(process.cwd(), "dist/web");

  await app.register(fastifyStatic, {
    root: webRoot,
    prefix: "/",
    wildcard: false,
  });

  app.get("/health", async () => {
    database.prepare("SELECT 1 AS ok").get();

    return {
      status: "ok",
      database: "ready",
      version: process.env.npm_package_version ?? "0.1.0",
    };
  });

  app.get("/api/v1/status", async () => ({
    application: "raven",
    environment: process.env.NODE_ENV ?? "development",
    providerCount: providers.list().length,
    sync: "manual",
  }));

  app.get("/api/v1/settings", async () => settingsService.getOverview());

  app.post("/api/v1/settings/providers/:providerId/check", async (request) =>
    settingsService.checkProvider(
      (request.params as { providerId: string }).providerId,
    ),
  );

  app.get("/api/v1/discovery/:format", async (request, reply) => {
    const format = resolveFormat(
      (request.params as { format?: string }).format,
      reply,
    );
    if (!format) return;
    const query = request.query as {
      kind?: string;
      search?: string;
      page?: string;
    };
    const kind = resolveDiscoveryKind(query.kind, query.search);
    const page = resolvePage(query.page);

    if (kind === "search" && !query.search?.trim()) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "search is required when kind is search",
      });
    }

    const result = await discoveryService.discover(format, {
      kind,
      search: query.search,
      page,
    });
    return {
      items: result.items,
      meta: {
        source: result.source,
        stale: result.stale,
        updatedAt: result.updatedAt,
      },
    };
  });

  app.get("/api/v1/sports/nba/teams", async (request) => {
    const { search } = request.query as { search?: string };
    const result = await discoveryService.discoverCached(
      "sport",
      { kind: search?.trim() ? "search" : "current", search },
      6 * 60 * 60 * 1000,
    );
    const identity = nbaTeamIdentityService?.enrich(result.items);
    return {
      items: identity?.items ?? result.items,
      meta: {
        source: result.source,
        stale: result.stale,
        updatedAt: result.updatedAt,
        ...(identity ? { assets: identity.coverage } : {}),
      },
    };
  });

  app.post(
    "/api/v1/sports/nba/teams/:externalId/follow",
    async (request, reply) => {
      const { externalId } = request.params as { externalId: string };
      if (!externalId.trim()) {
        return reply.code(400).send({
          error: "invalid_request",
          message: "externalId is required",
        });
      }
      const entity = await discoveryService.getEntity(
        "sport",
        "balldontlie-nba",
        externalId,
      );
      return reply.code(201).send(await trackingService.trackEntity(entity));
    },
  );

  app.get("/api/v1/sports/nba/tracking", async () => {
    const items = trackingService
      .listTracked("sport")
      .filter(
        (item) =>
          item.entity.provider === "balldontlie-nba" &&
          (item.entity.metadata?.competition as { id?: string } | undefined)
            ?.id === "nba",
      );
    const identity = nbaTeamIdentityService?.enrich(
      items.map((item) => item.entity),
    );
    const identities = new Map(
      identity?.items.map((item) => [item.externalId, item]) ?? [],
    );

    return {
      items: items.map((item) => ({
        ...item,
        entity: { ...item.entity, ...identities.get(item.entity.externalId) },
      })),
    };
  });

  app.get("/api/v1/tracking", async (request, reply) => {
    const formatValue = (request.query as { format?: string }).format;
    const format = resolveOptionalFormat(formatValue, reply);
    if (formatValue && !format) return;
    return { items: trackingService.listTracked(format) };
  });

  app.post("/api/v1/tracking/:format", async (request, reply) => {
    const format = resolveFormat(
      (request.params as { format?: string }).format,
      reply,
    );
    if (!format) return;
    const body = request.body as
      | { externalId?: unknown; provider?: unknown }
      | undefined;
    if (
      !body ||
      typeof body.externalId !== "string" ||
      !body.externalId.trim()
    ) {
      return reply
        .code(400)
        .send({ error: "invalid_request", message: "externalId is required" });
    }

    const provider =
      typeof body.provider === "string" && body.provider.trim()
        ? body.provider.trim()
        : providers.primaryFor(format).id;
    const entity = await discoveryService.getEntity(
      format,
      provider,
      body.externalId.trim(),
    );
    const item = await trackingService.trackEntity(entity);
    return reply.code(201).send(item);
  });

  app.post("/api/v1/tracking/:format/refresh", async (request, reply) => {
    const format = resolveFormat(
      (request.params as { format?: string }).format,
      reply,
    );
    if (!format) return;
    return reply.code(200).send(await syncCoordinator.refreshFormat(format));
  });

  app.delete("/api/v1/tracking/:entityId", async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    if (!trackingService.untrack(entityId)) {
      return reply.code(404).send({ error: "not_found" });
    }
    return reply.code(204).send();
  });

  app.get("/api/v1/upcoming", async (request, reply) => {
    const formatValue = (request.query as { format?: string }).format;
    const format = resolveOptionalFormat(formatValue, reply);
    if (formatValue && !format) return;
    return { items: trackingService.listTimeline(format) };
  });

  app.post("/api/v1/events/:eventId/watched", async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    if (!trackingService.markWatched(eventId)) {
      return reply.code(404).send({ error: "not_found" });
    }
    return reply.code(204).send();
  });

  app.get("/*", async (request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "not_found" });
    }
    return reply.sendFile("index.html");
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof InvalidRequestError) {
      return reply
        .code(400)
        .send({ error: "invalid_request", message: error.message });
    }

    if (error instanceof ProviderRequestError) {
      const statusCode = [404, 429].includes(error.statusCode ?? 0)
        ? error.statusCode!
        : 502;
      if (error.retryAfterSeconds !== undefined) {
        reply.header("retry-after", String(error.retryAfterSeconds));
      }
      return reply.code(statusCode).send({
        error:
          statusCode === 404
            ? "not_found"
            : statusCode === 429
              ? "provider_rate_limited"
              : "provider_unavailable",
        message:
          statusCode === 502
            ? "The configured provider is temporarily unavailable"
            : error.message,
      });
    }

    if (error instanceof ProviderNotRegisteredError) {
      return reply
        .code(404)
        .send({ error: "provider_not_configured", message: error.message });
    }

    if (error instanceof ProviderHealthTargetNotFoundError) {
      return reply
        .code(404)
        .send({ error: "provider_not_configured", message: error.message });
    }

    app.log.error(error);
    return reply.code(500).send({ error: "internal_error" });
  });

  app.addHook("onClose", async () => {
    database.close();
  });

  return app;
}

function resolveDiscoveryKind(
  kind: string | undefined,
  search: string | undefined,
) {
  if (!kind) return search?.trim() ? "search" : "current";
  if (kind === "search" || kind === "current" || kind === "next-season")
    return kind === "next-season" ? "nextSeason" : kind;
  throw new InvalidRequestError("kind must be search, current, or next-season");
}

function resolveFormat(
  value: string | undefined,
  reply: { code: (statusCode: number) => { send: (body: unknown) => unknown } },
): Format | undefined {
  if (value && (formats as readonly string[]).includes(value))
    return value as Format;
  reply.code(400).send({
    error: "invalid_request",
    message: `format must be one of ${formats.join(", ")}`,
  });
  return undefined;
}

function resolveOptionalFormat(
  value: string | undefined,
  reply: { code: (statusCode: number) => { send: (body: unknown) => unknown } },
): Format | undefined {
  if (!value) return undefined;
  return resolveFormat(value, reply);
}

function resolvePage(value: string | undefined): number {
  if (!value) return 1;
  const page = Number(value);
  if (!Number.isInteger(page) || page < 1 || page > 100) {
    throw new InvalidRequestError("page must be an integer between 1 and 100");
  }
  return page;
}
