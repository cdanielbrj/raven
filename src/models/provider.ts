import type { Entity, Event, Format } from "./media.js";

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

export interface DiscoveryQuery {
  search?: string;
  kind?: "search" | "current" | "nextSeason";
  page?: number;
}

export interface NormalizedEntity
  extends Omit<Entity, "id" | "createdAt" | "updatedAt"> {}

export interface NormalizedEvent
  extends Omit<Event, "id" | "entityId" | "createdAt" | "updatedAt"> {}

export interface NormalizedEventParticipant {
  provider: string;
  externalId: string;
  role: string;
}

export interface ProviderSyncPolicy {
  defaultIntervalMs: number;
  maxConcurrentSyncs: number;
}

export interface Provider {
  readonly id: string;
  readonly format: Format;
  readonly capabilities: {
    discovery: boolean;
    events: boolean;
    availability: boolean;
    covers: boolean;
    icons: boolean;
  };
  readonly authentication: { type: "none" | "instance" | "user" };
  readonly syncPolicy: ProviderSyncPolicy;
  discover(query: DiscoveryQuery): Promise<NormalizedEntity[]>;
  getEntity(externalId: string): Promise<NormalizedEntity>;
  getEvents(entity: NormalizedEntity): Promise<NormalizedEvent[]>;
}
