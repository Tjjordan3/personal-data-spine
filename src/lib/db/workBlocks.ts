import { addDaysToKey, daysBetweenKeys, todayKey, toDateKey } from "./dates";
import { getDatabase } from "./database";
import { createLink } from "./links";
import { getItemById, insertItem, updateItem } from "./items";
import type {
  Item,
  WorkBlockKind,
  WorkBlockMetadata,
  WorkBlockStatus,
} from "./types";

const WORK_BLOCK_SOURCE = "focus-timer";

function isWorkBlockMeta(metadata: Record<string, unknown>): boolean {
  return (
    typeof metadata.started_at === "string" &&
    typeof metadata.kind === "string"
  );
}

export function parseWorkBlockMeta(item: Item): WorkBlockMetadata | null {
  if (item.type !== "work_block") return null;
  if (!isWorkBlockMeta(item.metadata)) return null;
  return item.metadata as unknown as WorkBlockMetadata;
}

function blockDateKey(item: Item): string {
  const meta = parseWorkBlockMeta(item);
  if (!meta) return "";
  const ended = meta.ended_at ?? meta.started_at;
  return toDateKey(ended);
}

export async function startWorkBlock(input: {
  taskId: string | null;
  taskLabel: string;
  plannedMinutes: number;
  kind: WorkBlockKind;
}): Promise<Item> {
  const started_at = new Date().toISOString();
  const metadata: WorkBlockMetadata = {
    task_id: input.taskId,
    started_at,
    ended_at: null,
    duration_seconds: null,
    planned_minutes: input.plannedMinutes,
    notes: null,
    status: "in_progress",
    kind: input.kind,
  };

  const block = await insertItem({
    type: "work_block",
    content: input.taskLabel,
    tags: ["#focus"],
    source: WORK_BLOCK_SOURCE,
    metadata: metadata as unknown as Record<string, unknown>,
  });

  if (input.taskId) {
    try {
      await createLink(block.id, input.taskId, "focus_on");
    } catch (err) {
      console.warn("Could not link work block to task:", err);
    }
  }

  return block;
}

export async function finishWorkBlock(
  blockId: string,
  status: Exclude<WorkBlockStatus, "in_progress">,
  notes?: string | null,
): Promise<Item> {
  const item = await getItemById(blockId);
  if (!item || item.type !== "work_block") {
    throw new Error("Work block not found");
  }
  const meta = parseWorkBlockMeta(item);
  if (!meta) throw new Error("Invalid work block metadata");

  const ended_at = new Date().toISOString();
  const duration_seconds = Math.max(
    0,
    Math.round(
      (new Date(ended_at).getTime() - new Date(meta.started_at).getTime()) /
        1000,
    ),
  );

  return updateItem(blockId, {
    metadata: {
      ...meta,
      ended_at,
      duration_seconds,
      status,
      notes: notes ?? meta.notes,
    },
  });
}

export async function listCompletedFocusBlocks(limit = 500): Promise<Item[]> {
  const db = await getDatabase();
  const rows = await db.select<
    Array<{
      id: string;
      type: string;
      content: string;
      tags: string;
      created_at: string;
      source: string;
      metadata: string;
    }>
  >(
    `SELECT id, type, content, tags, created_at, source, metadata
     FROM items
     WHERE type = 'work_block'
       AND json_extract(metadata, '$.kind') = 'focus'
       AND json_extract(metadata, '$.status') = 'completed'
     ORDER BY json_extract(metadata, '$.ended_at') DESC
     LIMIT $1`,
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    type: "work_block" as const,
    content: row.content,
    tags: JSON.parse(row.tags) as string[],
    created_at: row.created_at,
    source: row.source,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
  }));
}

export async function focusMinutesForDateKey(dateKey: string): Promise<number> {
  const blocks = await listCompletedFocusBlocks();
  let totalSeconds = 0;
  for (const block of blocks) {
    if (blockDateKey(block) !== dateKey) continue;
    const meta = parseWorkBlockMeta(block);
    if (!meta?.duration_seconds) continue;
    totalSeconds += meta.duration_seconds;
  }
  return Math.round(totalSeconds / 60);
}

/** Days with ≥1 completed focus block, for streak calculation. */
export async function focusDayKeysSet(): Promise<Set<string>> {
  const blocks = await listCompletedFocusBlocks();
  const days = new Set<string>();
  for (const block of blocks) {
    const key = blockDateKey(block);
    if (key) days.add(key);
  }
  return days;
}

/**
 * Consecutive calendar days with ≥1 completed focus block, ending at the
 * most recent such day (today if focused today, else yesterday).
 */
export async function computeFocusStreakDays(): Promise<number> {
  const days = await focusDayKeysSet();
  if (days.size === 0) return 0;

  const today = todayKey();
  let cursor = today;
  if (!days.has(cursor)) {
    cursor = addDaysToKey(today, -1);
    if (!days.has(cursor)) return 0;
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDaysToKey(cursor, -1);
    if (daysBetweenKeys(cursor, today) > 400) break;
  }
  return streak;
}

export async function loadFocusTimerStats(): Promise<{
  focusMinutesToday: number;
  streakDays: number;
}> {
  const today = todayKey();
  const [focusMinutesToday, streakDays] = await Promise.all([
    focusMinutesForDateKey(today),
    computeFocusStreakDays(),
  ]);
  return { focusMinutesToday, streakDays };
}

export async function totalFocusMinutesForTask(taskId: string): Promise<number> {
  const db = await getDatabase();
  const rows = await db.select<{ metadata: string }[]>(
    `SELECT metadata FROM items
     WHERE type = 'work_block'
       AND json_extract(metadata, '$.task_id') = $1
       AND json_extract(metadata, '$.kind') = 'focus'
       AND json_extract(metadata, '$.status') = 'completed'`,
    [taskId],
  );
  let total = 0;
  for (const row of rows) {
    const meta = JSON.parse(row.metadata) as WorkBlockMetadata;
    if (meta.duration_seconds) total += meta.duration_seconds;
  }
  return Math.round(total / 60);
}
