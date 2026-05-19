import { getDatabase } from "./database";
import { deleteFtsRow, upsertFtsRow } from "./fts";
import { createLink, deleteLinksForItem, getLinksForItem } from "./links";
import type { ItemStatus } from "./itemStatus";
import type { Item, ItemType, NewItem } from "./types";

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
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }
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

export async function insertItem(item: NewItem): Promise<Item> {
  const db = await getDatabase();
  const id = item.id ?? crypto.randomUUID();
  const created_at = item.created_at ?? new Date().toISOString();
  const tags = JSON.stringify(item.tags ?? []);
  const metadata = JSON.stringify(item.metadata ?? {});

  await db.execute(
    `INSERT INTO items (id, type, content, tags, created_at, source, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, item.type, item.content, tags, created_at, item.source, metadata],
  );

  const saved: Item = {
    id,
    type: item.type,
    content: item.content,
    tags: item.tags ?? [],
    created_at,
    source: item.source,
    metadata: item.metadata ?? {},
  };
  if (item.type !== "work_block") {
    await upsertFtsRow(db, saved);
  }
  return saved;
}

function statusCondition(status: ItemStatus | "all"): string {
  if (status === "all") return "";
  if (status === "active") {
    return `(json_extract(metadata, '$.status') IS NULL OR json_extract(metadata, '$.status') = 'active')`;
  }
  return `json_extract(metadata, '$.status') = '${status}'`;
}

export async function getItemById(id: string): Promise<Item | null> {
  const db = await getDatabase();
  const rows = await db.select<ItemRow[]>(
    `SELECT id, type, content, tags, created_at, source, metadata
     FROM items WHERE id = $1`,
    [id],
  );
  return rows.length ? rowToItem(rows[0]) : null;
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDatabase();
  await deleteLinksForItem(id);
  await deleteFtsRow(db, id);
  await db.execute("DELETE FROM items WHERE id = $1", [id]);
}

export async function deleteMeetingWithTasks(meetingId: string): Promise<number> {
  const db = await getDatabase();
  const tasks = await getTasksForMeeting(meetingId);
  for (const task of tasks) {
    await db.execute("DELETE FROM items WHERE id = $1", [task.id]);
  }
  await db.execute("DELETE FROM items WHERE id = $1", [meetingId]);
  return tasks.length + 1;
}

export interface UpdateItemInput {
  content?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export async function updateItem(
  id: string,
  patch: UpdateItemInput,
): Promise<Item> {
  const item = await getItemById(id);
  if (!item) {
    throw new Error("Item not found");
  }

  const content = patch.content !== undefined ? patch.content : item.content;
  const tags = JSON.stringify(patch.tags ?? item.tags);
  const metadata = JSON.stringify({
    ...item.metadata,
    ...(patch.metadata ?? {}),
    updated_at: new Date().toISOString(),
  });

  const db = await getDatabase();
  await db.execute(
    "UPDATE items SET content = $1, tags = $2, metadata = $3 WHERE id = $4",
    [content, tags, metadata, id],
  );

  const updated = await getItemById(id);
  if (!updated) {
    throw new Error("Item not found after update");
  }
  if (updated.type !== "work_block") {
    const db = await getDatabase();
    await upsertFtsRow(db, updated);
  }
  return updated;
}

export async function setItemStatus(
  id: string,
  status: ItemStatus,
): Promise<Item> {
  const item = await getItemById(id);
  if (!item) {
    throw new Error("Item not found");
  }

  const metadata = { ...item.metadata };
  if (status === "active") {
    delete metadata.status;
    delete metadata.marked_at;
  } else {
    metadata.status = status;
    metadata.marked_at = new Date().toISOString();
  }
  metadata.updated_at = new Date().toISOString();

  const db = await getDatabase();
  await db.execute("UPDATE items SET metadata = $1 WHERE id = $2", [
    JSON.stringify(metadata),
    id,
  ]);

  const updated = { ...item, metadata };
  if (item.type !== "work_block") {
    await upsertFtsRow(db, updated);
  }
  return updated;
}

export async function markItemsDone(ids: string[]): Promise<number> {
  let count = 0;
  for (const id of ids) {
    const item = await getItemById(id);
    if (!item) continue;
    const status = item.metadata.status as string | undefined;
    if (status === "done" || status === "archived") continue;
    await setItemStatus(id, "done");
    count += 1;
  }
  return count;
}

/** Copy item with new id; resets status to active and created_at to now. */
export async function duplicateItem(
  sourceId: string,
  options?: { copyLinks?: boolean },
): Promise<Item> {
  const source = await getItemById(sourceId);
  if (!source) {
    throw new Error("Item not found");
  }
  if (source.type === "work_block") {
    throw new Error("Cannot duplicate work blocks");
  }

  const metadata = { ...source.metadata };
  delete metadata.status;
  delete metadata.marked_at;
  delete metadata.outcome;

  const copy = await insertItem({
    type: source.type,
    content: source.content,
    tags: [...source.tags],
    source: `duplicate:${source.id}`,
    metadata,
  });

  if (options?.copyLinks) {
    const links = await getLinksForItem(sourceId);
    const neighbors = new Set<string>();
    for (const link of links) {
      const other = link.from_id === sourceId ? link.to_id : link.from_id;
      if (other !== copy.id) neighbors.add(other);
    }
    for (const neighborId of neighbors) {
      try {
        await createLink(copy.id, neighborId, "related");
        await createLink(neighborId, copy.id, "related");
      } catch {
        /* link may exist */
      }
    }
  }

  return copy;
}

export async function listItems(options?: {
  type?: ItemType;
  tag?: string;
  status?: ItemStatus | "all";
  limit?: number;
}): Promise<Item[]> {
  const db = await getDatabase();
  const limit = options?.limit ?? 200;
  const params: unknown[] = [];
  const conditions: string[] = [];
  const status = options?.status ?? "active";

  if (status !== "all") {
    conditions.push(statusCondition(status));
  }

  if (options?.type) {
    const idx = params.length + 1;
    conditions.push(`type = $${idx}`);
    params.push(options.type);
  }

  if (options?.tag) {
    const idx = params.length + 1;
    const normalized = options.tag.startsWith("#")
      ? options.tag
      : `#${options.tag}`;
    conditions.push(`tags LIKE $${idx}`);
    params.push(`%"${normalized}"%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit);

  const rows = await db.select<ItemRow[]>(
    `SELECT id, type, content, tags, created_at, source, metadata
     FROM items
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  return rows.map(rowToItem);
}

export async function searchItems(
  query: string,
  status: ItemStatus | "all" = "active",
): Promise<Item[]> {
  const db = await getDatabase();
  const pattern = `%${query.trim()}%`;
  const statusClause =
    status === "all" ? "" : ` AND ${statusCondition(status)}`;
  const rows = await db.select<ItemRow[]>(
    `SELECT id, type, content, tags, created_at, source, metadata
     FROM items
     WHERE (content LIKE $1 OR tags LIKE $1 OR type LIKE $1)${statusClause}
     ORDER BY created_at DESC
     LIMIT 200`,
    [pattern],
  );
  return rows.map(rowToItem);
}


export async function getTasksForMeeting(meetingId: string): Promise<Item[]> {
  const db = await getDatabase();
  const rows = await db.select<ItemRow[]>(
    `SELECT id, type, content, tags, created_at, source, metadata
     FROM items
     WHERE type = 'task' AND json_extract(metadata, '$.meeting_id') = $1
     ORDER BY created_at ASC`,
    [meetingId],
  );
  return rows.map(rowToItem);
}

export async function saveMeetingWithTasks(
  meetingContent: string,
  tasks: Array<{
    content: string;
    owner: string | null;
    due_date: string | null;
    project_id?: string | null;
  }>,
  options?: {
    title?: string | null;
    decisions?: string[];
  },
): Promise<{ meeting: Item; tasks: Item[] }> {
  const notes = meetingContent.trim();
  if (!notes) {
    throw new Error("Meeting notes are required.");
  }

  const normalizedTasks = tasks
    .map((t) => ({
      ...t,
      content: t.content.trim(),
    }))
    .filter((t) => t.content.length > 0);

  const decisions = (options?.decisions ?? [])
    .map((d) => d.trim())
    .filter(Boolean);

  const meetingId = crypto.randomUUID();
  const parsed_at = new Date().toISOString();
  const title = options?.title?.trim() || null;

  const meeting = await insertItem({
    id: meetingId,
    type: "meeting",
    content: meetingContent,
    tags: ["#meeting"],
    source: "meeting-mode",
    metadata: {
      title,
      parsed_at,
      task_count: normalizedTasks.length,
      ...(decisions.length > 0 ? { decisions } : {}),
    },
  });

  const savedTasks: Item[] = [];
  for (const task of normalizedTasks) {
    const saved = await insertItem({
      type: "task",
      content: task.content,
      tags: ["#task"],
      source: "meeting-mode",
      metadata: {
        meeting_id: meetingId,
        owner: task.owner?.trim() || null,
        due_date: task.due_date?.trim() || null,
        project_id: task.project_id?.trim() || null,
      },
    });
    savedTasks.push(saved);
  }

  return { meeting, tasks: savedTasks };
}
