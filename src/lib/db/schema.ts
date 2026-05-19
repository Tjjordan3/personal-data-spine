import type Database from "@tauri-apps/plugin-sql";
import { getDatabase } from "./database";
import { rebuildFtsIndex } from "./fts";

/**
 * Database schema upgrade policy
 * --------------------------------
 * - CURRENT_SCHEMA_VERSION is bumped when migrations add columns, tables, or
 *   backfills that existing installs must run once.
 * - All DDL uses CREATE IF NOT EXISTS / INSERT OR IGNORE so re-runs are safe.
 * - Version is stored in app_metadata (key schema_version), not PRAGMA
 *   user_version, so we can add other metadata keys later.
 * - On startup, ensureCoreSchema reads the stored version and applies only
 *   migrations with version > stored (0 = legacy DB before tracking).
 * - Never drop user data in migrations; export a backup before major upgrades.
 * - When adding migration v2+, implement migrateToV2 and extend runMigrations.
 */
export const CURRENT_SCHEMA_VERSION = 1;

const SCHEMA_VERSION_KEY = "schema_version";

let schemaReady: Promise<void> | null = null;

async function ensureAppMetadataTable(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}

async function readStoredSchemaVersion(db: Database): Promise<number> {
  await ensureAppMetadataTable(db);
  const rows = await db.select<Array<{ value: string }>>(
    "SELECT value FROM app_metadata WHERE key = $1",
    [SCHEMA_VERSION_KEY],
  );
  if (!rows.length) return 0;
  const parsed = Number.parseInt(rows[0].value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function writeSchemaVersion(db: Database, version: number): Promise<void> {
  await ensureAppMetadataTable(db);
  await db.execute(
    `INSERT INTO app_metadata (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [SCHEMA_VERSION_KEY, String(version)],
  );
}

async function ensureFtsSchema(db: Database): Promise<void> {
  await db.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
      item_id UNINDEXED,
      content,
      tags,
      title,
      tokenize = 'porter unicode61'
    );
  `);
  await rebuildFtsIndex(db);
}

async function backfillMeetingLinks(db: Database): Promise<void> {
  await db.execute(`
    INSERT OR IGNORE INTO item_links (id, from_id, to_id, link_type, created_at)
    SELECT
      lower(hex(randomblob(16))),
      id,
      json_extract(metadata, '$.meeting_id'),
      'action_of',
      created_at
    FROM items
    WHERE type = 'task'
      AND json_extract(metadata, '$.meeting_id') IS NOT NULL
  `);
  await db.execute(`
    INSERT OR IGNORE INTO item_links (id, from_id, to_id, link_type, created_at)
    SELECT
      lower(hex(randomblob(16))),
      json_extract(metadata, '$.meeting_id'),
      id,
      'has_action',
      created_at
    FROM items
    WHERE type = 'task'
      AND json_extract(metadata, '$.meeting_id') IS NOT NULL
  `);
}

/** v1: core items, links, FTS, meeting link backfill. */
async function migrateToV1(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS items (
      id         TEXT PRIMARY KEY NOT NULL,
      type       TEXT NOT NULL,
      content    TEXT NOT NULL,
      tags       TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      source     TEXT NOT NULL DEFAULT '',
      metadata   TEXT NOT NULL DEFAULT '{}'
    );
  `);
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC)",
  );
  await db.execute(`
    CREATE TABLE IF NOT EXISTS item_links (
      id         TEXT PRIMARY KEY NOT NULL,
      from_id    TEXT NOT NULL,
      to_id      TEXT NOT NULL,
      link_type  TEXT NOT NULL DEFAULT 'related',
      created_at TEXT NOT NULL,
      UNIQUE(from_id, to_id, link_type)
    );
  `);
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_item_links_from ON item_links(from_id)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_item_links_to ON item_links(to_id)",
  );
  await backfillMeetingLinks(db);
  await ensureFtsSchema(db);
}

async function runMigrations(db: Database): Promise<void> {
  let version = await readStoredSchemaVersion(db);

  if (version < 1) {
    await migrateToV1(db);
    version = 1;
    await writeSchemaVersion(db, 1);
  }

  // Future: if (version < 2) { await migrateToV2(db); version = 2; await writeSchemaVersion(db, 2); }

  if (version < CURRENT_SCHEMA_VERSION) {
    await writeSchemaVersion(db, CURRENT_SCHEMA_VERSION);
  }
}

/** Returns the schema version after migrations (same as CURRENT_SCHEMA_VERSION when up to date). */
export async function getSchemaVersion(
  existing?: Database,
): Promise<number> {
  const db = existing ?? (await getDatabase());
  return readStoredSchemaVersion(db);
}

/** Ensures core tables exist and applies incremental schema migrations. */
export async function ensureCoreSchema(existing?: Database): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = existing ?? (await getDatabase());
      await runMigrations(db);
    })();
  }
  return schemaReady;
}

/** @deprecated Use ensureCoreSchema */
export async function ensureItemLinksTable(
  existing?: Database,
): Promise<void> {
  return ensureCoreSchema(existing);
}
