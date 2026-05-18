import { getDatabase } from "./database";
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

  return {
    id,
    type: item.type,
    content: item.content,
    tags: item.tags ?? [],
    created_at,
    source: item.source,
    metadata: item.metadata ?? {},
  };
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

  const db = await getDatabase();
  await db.execute("UPDATE items SET metadata = $1 WHERE id = $2", [
    JSON.stringify(metadata),
    id,
  ]);

  return { ...item, metadata };
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
  }>,
): Promise<{ meeting: Item; tasks: Item[] }> {
  const meetingId = crypto.randomUUID();
  const parsed_at = new Date().toISOString();

  const meeting = await insertItem({
    id: meetingId,
    type: "meeting",
    content: meetingContent,
    tags: ["#meeting"],
    source: "meeting-mode",
    metadata: { parsed_at, task_count: tasks.length },
  });

  const savedTasks: Item[] = [];
  for (const task of tasks) {
    const saved = await insertItem({
      type: "task",
      content: task.content,
      tags: ["#task"],
      source: "meeting-mode",
      metadata: {
        meeting_id: meetingId,
        owner: task.owner,
        due_date: task.due_date,
      },
    });
    savedTasks.push(saved);
  }

  return { meeting, tasks: savedTasks };
}
