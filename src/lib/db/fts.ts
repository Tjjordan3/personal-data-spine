import type Database from "@tauri-apps/plugin-sql";
import { getDatabase } from "./database";
import type { Item } from "./types";

function ftsTitle(metadata: Record<string, unknown>): string {
  const t = metadata.title;
  return typeof t === "string" ? t.trim() : "";
}

function tagsPlain(tags: string[]): string {
  return tags.join(" ");
}

/** Escape user text for FTS5 MATCH (prefix terms). */
export function escapeFtsQuery(raw: string): string {
  const terms = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/['"]/g, "").replace(/[^\w#-]/g, ""))
    .filter(Boolean);
  if (terms.length === 0) return "";
  return terms.map((t) => `"${t}"*`).join(" ");
}

export async function upsertFtsRow(
  db: Database,
  item: Pick<Item, "id" | "content" | "tags" | "metadata">,
): Promise<void> {
  await db.execute("DELETE FROM items_fts WHERE item_id = $1", [item.id]);
  await db.execute(
    `INSERT INTO items_fts (item_id, content, tags, title)
     VALUES ($1, $2, $3, $4)`,
    [item.id, item.content, tagsPlain(item.tags), ftsTitle(item.metadata)],
  );
}

export async function deleteFtsRow(
  db: Database,
  itemId: string,
): Promise<void> {
  await db.execute("DELETE FROM items_fts WHERE item_id = $1", [itemId]);
}

export async function rebuildFtsIndex(existing?: Database): Promise<void> {
  const db = existing ?? (await getDatabase());
  await db.execute("DELETE FROM items_fts");
  const rows = await db.select<
    Array<{
      id: string;
      content: string;
      tags: string;
      metadata: string;
    }>
  >(
    `SELECT id, content, tags, metadata FROM items WHERE type != 'work_block'`,
  );
  for (const row of rows) {
    let tags: string[] = [];
    let metadata: Record<string, unknown> = {};
    try {
      tags = JSON.parse(row.tags) as string[];
    } catch {
      tags = [];
    }
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      metadata = {};
    }
    await upsertFtsRow(db, {
      id: row.id,
      content: row.content,
      tags,
      metadata,
    });
  }
}

interface FtsHit {
  item_id: string;
}

/** Returns item IDs matching FTS query, or empty if FTS unavailable / no hits. */
export async function ftsSearchItemIds(query: string): Promise<string[]> {
  const match = escapeFtsQuery(query);
  if (!match) return [];
  const db = await getDatabase();
  try {
    const rows = await db.select<FtsHit[]>(
      `SELECT item_id FROM items_fts WHERE items_fts MATCH $1 ORDER BY rank LIMIT 300`,
      [match],
    );
    return rows.map((r) => r.item_id);
  } catch {
    return [];
  }
}
