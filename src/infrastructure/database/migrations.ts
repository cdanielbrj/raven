import type Database from "better-sqlite3";

interface Migration {
  id: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    id: "001_initial",
    sql: `
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE entities (
        id TEXT PRIMARY KEY,
        format TEXT NOT NULL CHECK (format IN ('anime', 'sport', 'series', 'movie', 'game')),
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        external_id TEXT NOT NULL,
        cover_url TEXT,
        icon_url TEXT,
        external_url TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (provider, external_id)
      );

      CREATE TABLE tracking (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL UNIQUE REFERENCES entities(id) ON DELETE CASCADE,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        preferences TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE events (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        name TEXT,
        type TEXT NOT NULL,
        format TEXT NOT NULL CHECK (format IN ('anime', 'sport', 'series', 'movie', 'game')),
        episode_number INTEGER,
        starts_at TEXT,
        starts_on TEXT,
        time_precision TEXT NOT NULL CHECK (time_precision IN ('datetime', 'date')),
        ends_at TEXT,
        provider TEXT NOT NULL,
        external_id TEXT,
        external_url TEXT,
        source TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (time_precision = 'datetime' AND starts_at IS NOT NULL AND starts_on IS NULL)
          OR (time_precision = 'date' AND starts_on IS NOT NULL AND starts_at IS NULL)
        ),
        UNIQUE (provider, external_id)
      );

      CREATE INDEX events_by_timeline ON events (starts_at, starts_on);
      CREATE INDEX events_by_entity ON events (entity_id);

      CREATE TABLE dismissed_events (
        provider TEXT NOT NULL,
        external_event_id TEXT NOT NULL,
        entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (provider, external_event_id)
      );

      CREATE TABLE provider_sync_state (
        provider TEXT PRIMARY KEY,
        last_started_at TEXT,
        last_succeeded_at TEXT,
        last_failed_at TEXT,
        retry_after_at TEXT,
        last_error TEXT,
        updated_at TEXT NOT NULL
      );
    `,
  },
];

export function applyMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const alreadyApplied = database.prepare(
    "SELECT id FROM schema_migrations WHERE id = ?",
  );
  const recordMigration = database.prepare(
    "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
  );

  for (const migration of migrations) {
    if (alreadyApplied.get(migration.id)) {
      continue;
    }

    database.transaction(() => {
      database.exec(migration.sql);
      recordMigration.run(migration.id, new Date().toISOString());
    })();
  }
}
