import { getDatabase } from "./database";
import { ensureItemLinksTable } from "./schema";
import { getItemById } from "./items";
import type { Item } from "./types";

export type LinkType =
  | "related"
  | "action_of"
  | "has_action"
  | "source"
  | "references"
  | "focus_on";

export interface ItemLink {
  id: string;
  from_id: string;
  to_id: string;
  link_type: LinkType;
  created_at: string;
}

interface LinkRow {
  id: string;
  from_id: string;
  to_id: string;
  link_type: string;
  created_at: string;
}

export async function createLink(
  fromId: string,
  toId: string,
  linkType: LinkType = "related",
): Promise<ItemLink> {
  if (fromId === toId) {
    throw new Error("Cannot link an item to itself");
  }
  await ensureItemLinksTable();
  const db = await getDatabase();
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  await db.execute(
    `INSERT OR IGNORE INTO item_links (id, from_id, to_id, link_type, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, fromId, toId, linkType, created_at],
  );
  return { id, from_id: fromId, to_id: toId, link_type: linkType, created_at };
}

export async function createBidirectionalLink(
  aId: string,
  bId: string,
  aToB: LinkType = "related",
  bToA: LinkType = "related",
): Promise<void> {
  await createLink(aId, bId, aToB);
  await createLink(bId, aId, bToA);
}

export async function linkMeetingTask(
  meetingId: string,
  taskId: string,
): Promise<void> {
  await createLink(taskId, meetingId, "action_of");
  await createLink(meetingId, taskId, "has_action");
}

export async function deleteLinksForItem(itemId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    "DELETE FROM item_links WHERE from_id = $1 OR to_id = $1",
    [itemId],
  );
}

export async function getLinksForItem(itemId: string): Promise<ItemLink[]> {
  const db = await getDatabase();
  const rows = await db.select<LinkRow[]>(
    `SELECT id, from_id, to_id, link_type, created_at
     FROM item_links
     WHERE from_id = $1 OR to_id = $1
     ORDER BY created_at DESC`,
    [itemId],
  );
  return rows.map((row) => ({
    ...row,
    link_type: row.link_type as LinkType,
  }));
}

export async function getRelatedItems(itemId: string): Promise<
  Array<{
    item: Item;
    link: ItemLink;
    direction: "outgoing" | "incoming";
  }>
> {
  const links = await getLinksForItem(itemId);
  const related: Array<{
    item: Item;
    link: ItemLink;
    direction: "outgoing" | "incoming";
  }> = [];

  for (const link of links) {
    const otherId = link.from_id === itemId ? link.to_id : link.from_id;
    const item = await getItemById(otherId);
    if (!item) continue;
    related.push({
      item,
      link,
      direction: link.from_id === itemId ? "outgoing" : "incoming",
    });
  }

  return related;
}

export async function listAllLinks(): Promise<ItemLink[]> {
  await ensureItemLinksTable();
  const db = await getDatabase();
  const rows = await db.select<LinkRow[]>(
    `SELECT id, from_id, to_id, link_type, created_at
     FROM item_links
     ORDER BY created_at ASC`,
  );
  return rows.map((row) => ({
    ...row,
    link_type: row.link_type as LinkType,
  }));
}

export function linkTypeLabel(linkType: LinkType): string {
  const labels: Record<LinkType, string> = {
    related: "related",
    action_of: "action of",
    has_action: "has action",
    source: "source",
    references: "references",
    focus_on: "focus on",
  };
  return labels[linkType] ?? linkType;
}
