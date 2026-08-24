import path from "node:path";

function readPort(value: string | undefined): number {
  const port = Number(value ?? "8080");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

export interface AppConfig {
  host: string;
  port: number;
  dataDirectory: string;
  databasePath: string;
  malClientId?: string;
  ballDontLieApiKey?: string;
  theSportsDbApiKey?: string;
}

export function loadConfig(environment = process.env): AppConfig {
  const dataDirectory = path.resolve(environment.RAVEN_DATA_DIR ?? "/data");

  return {
    host: environment.HOST ?? "0.0.0.0",
    port: readPort(environment.PORT),
    dataDirectory,
    databasePath: path.join(dataDirectory, "raven.db"),
    malClientId: environment.MAL_CLIENT_ID?.trim() || undefined,
    ballDontLieApiKey: environment.BALLDONTLIE_API_KEY?.trim() || undefined,
    theSportsDbApiKey: environment.THESPORTSDB_API_KEY?.trim() || undefined,
  };
}
