import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../src/infrastructure/database/database.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("database foundation", () => {
  it("creates the Raven schema and enables WAL mode", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "raven-test-"));
    temporaryDirectories.push(directory);
    const database = openDatabase(path.join(directory, "raven.db"));

    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining([
        "dismissed_events",
        "entities",
        "events",
        "provider_health",
        "provider_sync_state",
        "schema_migrations",
        "settings",
        "tracking",
      ]),
    );
    expect(database.pragma("journal_mode", { simple: true })).toBe("wal");

    database.close();
  });
});
