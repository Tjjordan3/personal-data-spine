import type Database from "@tauri-apps/plugin-sql";
import { getDatabase } from "./database";
import { rebuildFtsIndex } from "./fts";

let v2SchemaReady: Promise<void> | null = null;

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

/** Ensures core tables exist without touching sqlx migration checksums. */
export async function ensureCoreSchema(existing?: Database): Promise<void> {
  if (!v2SchemaReady) {
    v2SchemaReady = (async () => {
      const db = existing ?? (await getDatabase());
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
    })();
  }
  return v2SchemaReady;
}

/** @deprecated Use ensureCoreSchema */
export async function ensureItemLinksTable(
  existing?: Database,
): Promise<void> {
  return ensureCoreSchema(existing);
}
