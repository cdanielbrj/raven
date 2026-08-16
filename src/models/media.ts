export const formats = ["anime", "sport", "series", "movie", "game"] as const;
export type Format = (typeof formats)[number];

export const eventTimePrecisions = ["datetime", "date"] as const;
export type EventTimePrecision = (typeof eventTimePrecisions)[number];

export interface Entity {
  id: string;
  format: Format;
  name: string;
  provider: string;
  externalId: string;
  coverUrl: string | null;
  iconUrl: string | null;
  externalUrl: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  entityId: string;
  name: string | null;
  type: string;
  format: Format;
  episodeNumber: number | null;
  startsAt: string | null;
  startsOn: string | null;
  timePrecision: EventTimePrecision;
  endsAt: string | null;
  provider: string;
  externalId: string | null;
  externalUrl: string | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Tracking {
  id: string;
  entityId: string;
  enabled: boolean;
  preferences: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
