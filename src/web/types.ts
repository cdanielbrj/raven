export type ProviderConnectionStatus =
  | "available"
  | "not_checked"
  | "not_configured"
  | "unavailable";

export interface SettingsOverview {
  installation: {
    mode: "local-first";
    version: string;
  };
  database: {
    sizeBytes: number;
    schemaVersion: number;
    trackedItems: number;
    upcomingEvents: number;
    discoverySnapshots: number;
  };
  providers: Array<{
    id: string;
    label: string;
    status: ProviderConnectionStatus;
    lastCheckedAt: string | null;
    lastSucceededAt: string | null;
  }>;
}

export interface StartDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface Trailer {
  id?: string | null;
  site?: string | null;
  thumbnail?: string | null;
}

export interface Availability {
  site?: string | null;
  url?: string | null;
  icon?: string | null;
  color?: string | null;
}

export interface MediaMetadata {
  status?: string;
  season?: string;
  seasonYear?: number;
  startDate?: StartDate | null;
  genres?: string[];
  bannerImage?: string | null;
  trailer?: Trailer | null;
  availability?: Availability | null;
}

export interface Entity {
  id?: string;
  name: string;
  format: string;
  externalId: string;
  provider: string;
  coverUrl: string | null;
  metadata: MediaMetadata | null;
}

export interface DiscoveryResponse {
  items: Entity[];
  meta: {
    source: string;
    stale: boolean;
    updatedAt: string;
  };
}

export interface TimelineEvent {
  id: string;
  type: string;
  episodeNumber: number | null;
  startsAt: string | null;
  startsOn: string | null;
  entity: {
    name: string;
    format: string;
    coverUrl: string | null;
    metadata: MediaMetadata | null;
  };
}

export interface TrackedItem {
  entity: Entity;
  nextEvent: TimelineEvent | null;
  syncStatus: "synced" | "pending";
}
