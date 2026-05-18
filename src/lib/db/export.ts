import { writeTextFile } from "@tauri-apps/plugin-fs";
import { getDatabase } from "./database";
import { listAllLinks } from "./links";
import type { Item, ItemType } from "./types";

export interface PdsJsonExport {
  version: 1;
  exported_at: string;
  items: Item[];
  item_links: Awaited<ReturnType<typeof listAllLinks>>;
}

interface ItemRow {
  id: string;
  type: string;
  content: string;
  tags: string | string[];
  created_at: string;
  source: string;
  metadata: string | Record<string, unknown>;
}

function parseJsonField<T>(value: string | T): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value;
}

function rowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    type: row.type as ItemType,
    content: row.content,
    tags: parseJsonField<string[]>(row.tags),
    created_at: row.created_at,
    source: row.source,
    metadata: parseJsonField<Record<string, unknown>>(row.metadata),
  };
}

export async function loadAllItemsForExport(): Promise<Item[]> {
  const db = await getDatabase();
  const rows = await db.select<ItemRow[]>(
    `SELECT id, type, content, tags, created_at, source, metadata
     FROM items
     ORDER BY created_at ASC`,
  );
  return rows.map(rowToItem);
}

export async function buildJsonExport(): Promise<PdsJsonExport> {
  const [items, item_links] = await Promise.all([
    loadAllItemsForExport(),
    listAllLinks(),
  ]);
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    items,
    item_links,
  };
}

export async function writeJsonExport(path: string): Promise<PdsJsonExport> {
  const payload = await buildJsonExport();
  await writeTextFile(path, JSON.stringify(payload, null, 2));
  return payload;
}
