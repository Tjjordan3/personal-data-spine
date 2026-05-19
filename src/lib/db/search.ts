import { getGraphNeighborhoodIds } from "./graph";
import { ftsSearchItemIds } from "./fts";
import { getItemStatus, type ItemStatus } from "./itemStatus";
import { getDatabase } from "./database";
import type { Item, ItemType } from "./types";

export interface SearchFacets {
  query?: string;
  type?: ItemType | "all";
  tag?: string;
  status?: ItemStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  dueSoon?: boolean;
  linkedToId?: string;
}

export interface SearchResult {
  item: Item;
  reasons: string[];
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

function statusCondition(status: ItemStatus | "all"): string {
  if (status === "all") return "";
  if (status === "active") {
    return `(json_extract(metadata, '$.status') IS NULL OR json_extract(metadata, '$.status') = 'active')`;
  }
  return `json_extract(metadata, '$.status') = '${status}'`;
}

function isDueSoon(item: Item, withinDays = 7): boolean {
  if (item.type !== "task") return false;
  const due = item.metadata.due_date as string | undefined;
  if (!due) return false;
  const dueDate = new Date(due);
  if (Number.isNaN(dueDate.getTime())) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const limit = new Date(now);
  limit.setDate(limit.getDate() + withinDays);
  return dueDate >= now && dueDate <= limit;
}

function meetingTitleMatch(item: Item, q: string): boolean {
  const title = item.metadata.title;
  if (typeof title !== "string") return false;
  return title.toLowerCase().includes(q);
}

function buildReasons(
  item: Item,
  facets: SearchFacets,
  linkedIds: Set<string>,
  ftsHit: boolean,
): string[] {
  const reasons: string[] = [];
  const q = facets.query?.trim().toLowerCase();

  if (ftsHit) {
    reasons.push("Full-text match");
  }

  if (q) {
    if (item.content.toLowerCase().includes(q)) {
      reasons.push("Content match");
    }
    if (meetingTitleMatch(item, q)) {
      reasons.push("Title match");
    }
    if (item.type.toLowerCase().includes(q)) {
      reasons.push("Type match");
    }
    if (item.tags.some((t) => t.toLowerCase().includes(q))) {
      reasons.push("Tag match");
    }
  }

  if (facets.type && facets.type !== "all" && item.type === facets.type) {
    reasons.push(`Type: ${item.type}`);
  }

  if (facets.tag && facets.tag !== "all") {
    const normalized = facets.tag.startsWith("#")
      ? facets.tag.toLowerCase()
      : `#${facets.tag.toLowerCase()}`;
    if (item.tags.some((t) => t.toLowerCase() === normalized)) {
      reasons.push(`Tag: ${normalized}`);
    }
  }

  if (facets.status && facets.status !== "all") {
    const status = getItemStatus(item);
    if (status === facets.status) {
      reasons.push(`Status: ${status}`);
    }
  }

  if (facets.dateFrom && item.created_at >= facets.dateFrom) {
    reasons.push(`Created after ${facets.dateFrom.slice(0, 10)}`);
  }
  if (facets.dateTo && item.created_at <= `${facets.dateTo}T23:59:59.999Z`) {
    reasons.push(`Created before ${facets.dateTo.slice(0, 10)}`);
  }

  if (facets.dueSoon && isDueSoon(item)) {
    reasons.push("Due within 7 days");
  }

  if (facets.linkedToId && linkedIds.has(item.id)) {
    reasons.push("Linked to selected item");
  }

  if (reasons.length === 0) reasons.push("Matches filters");
  return [...new Set(reasons)];
}

export async function searchWithFacets(
  facets: SearchFacets,
): Promise<SearchResult[]> {
  const db = await getDatabase();
  const params: unknown[] = [];
  const conditions: string[] = [`type != 'work_block'`];
  const status = facets.status ?? "active";
  const queryTrim = facets.query?.trim() ?? "";

  if (status !== "all") {
    conditions.push(statusCondition(status));
  }

  if (facets.type && facets.type !== "all") {
    const idx = params.length + 1;
    conditions.push(`type = $${idx}`);
    params.push(facets.type);
  }

  if (facets.tag && facets.tag !== "all") {
    const idx = params.length + 1;
    const normalized = facets.tag.startsWith("#")
      ? facets.tag
      : `#${facets.tag}`;
    conditions.push(`tags LIKE $${idx}`);
    params.push(`%"${normalized}"%`);
  }

  if (facets.dateFrom) {
    const idx = params.length + 1;
    conditions.push(`created_at >= $${idx}`);
    params.push(facets.dateFrom);
  }

  if (facets.dateTo) {
    const idx = params.length + 1;
    conditions.push(`created_at <= $${idx}`);
    params.push(`${facets.dateTo}T23:59:59.999Z`);
  }

  let ftsIds: string[] = [];
  let usedFts = false;
  if (queryTrim) {
    ftsIds = await ftsSearchItemIds(queryTrim);
    if (ftsIds.length > 0) {
      usedFts = true;
      const idx = params.length + 1;
      const placeholders = ftsIds.map((_, i) => `$${idx + i}`).join(", ");
      conditions.push(`id IN (${placeholders})`);
      params.push(...ftsIds);
    } else {
      const idx = params.length + 1;
      conditions.push(
        `(content LIKE $${idx} OR tags LIKE $${idx} OR type LIKE $${idx} OR json_extract(metadata, '$.title') LIKE $${idx})`,
      );
      params.push(`%${queryTrim}%`);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await db.select<ItemRow[]>(
    `SELECT id, type, content, tags, created_at, source, metadata
     FROM items
     ${where}
     ORDER BY created_at DESC
     LIMIT 300`,
    params,
  );

  let items = rows.map(rowToItem);

  if (usedFts && ftsIds.length > 0) {
    const order = new Map(ftsIds.map((id, i) => [id, i]));
    items.sort(
      (a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999),
    );
  }

  if (facets.dueSoon) {
    items = items.filter((item) => isDueSoon(item));
  }

  let linkedNeighborIds = new Set<string>();
  if (facets.linkedToId) {
    linkedNeighborIds = await getGraphNeighborhoodIds(facets.linkedToId);
    items = items.filter((item) => linkedNeighborIds.has(item.id));
  }

  const ftsSet = new Set(ftsIds);

  return items.map((item) => ({
    item,
    reasons: buildReasons(
      item,
      facets,
      linkedNeighborIds,
      ftsSet.has(item.id),
    ),
  }));
}
