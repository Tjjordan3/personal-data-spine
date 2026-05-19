import {
  addDaysToKey,
  addMonthsToKey,
  addYearsToKey,
  todayKey,
  toDateKey,
} from "./db/dates";

/** Recurrence interval for tasks and subscriptions (metadata.recurrence). */
export type RecurrenceInterval = "weekly" | "monthly" | "yearly";

/**
 * Structured recurrence on tasks/subscriptions:
 * `{ interval: 'weekly'|'monthly'|'yearly', anchor_date?: 'YYYY-MM-DD' }`
 * Alternative: `recurrence_rule` string with same interval names.
 */
export interface ItemRecurrence {
  interval: RecurrenceInterval;
  /** First occurrence anchor; falls back to due_date / renewal_date / created_at. */
  anchor_date?: string;
}

export const RECURRENCE_INTERVAL_OPTIONS: {
  value: RecurrenceInterval | "";
  label: string;
}[] = [
  { value: "", label: "None" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function parseRecurrence(
  metadata: Record<string, unknown>,
): ItemRecurrence | null {
  const raw = metadata.recurrence;
  if (raw && typeof raw === "object" && raw !== null) {
    const interval = (raw as ItemRecurrence).interval;
    if (
      interval === "weekly" ||
      interval === "monthly" ||
      interval === "yearly"
    ) {
      const anchor = (raw as ItemRecurrence).anchor_date;
      return {
        interval,
        anchor_date:
          typeof anchor === "string" && anchor.trim() ? anchor.trim() : undefined,
      };
    }
  }
  const rule = metadata.recurrence_rule;
  if (typeof rule === "string") {
    const lower = rule.trim().toLowerCase();
    if (lower === "weekly" || lower === "monthly" || lower === "yearly") {
      return { interval: lower as RecurrenceInterval };
    }
  }
  return null;
}

export function recurrenceToMetadata(
  interval: RecurrenceInterval | "",
  anchorDate: string,
): Record<string, unknown> | null {
  if (!interval) {
    return { recurrence: null, recurrence_rule: null };
  }
  const recurrence: ItemRecurrence = { interval };
  if (anchorDate.trim()) {
    recurrence.anchor_date = anchorDate.trim();
  }
  return { recurrence, recurrence_rule: interval };
}

function advanceOnce(key: string, interval: RecurrenceInterval): string {
  switch (interval) {
    case "weekly":
      return addDaysToKey(key, 7);
    case "monthly":
      return addMonthsToKey(key, 1);
    case "yearly":
      return addYearsToKey(key, 1);
  }
}

/** Next occurrence on or after `fromKey` (defaults to today). */
export function nextOccurrenceOnOrAfter(
  anchorKey: string,
  interval: RecurrenceInterval,
  fromKey: string = todayKey(),
): string {
  if (!anchorKey) return "";
  let current = anchorKey;
  let guard = 0;
  while (current < fromKey && guard < 600) {
    current = advanceOnce(current, interval);
    guard += 1;
  }
  return current;
}

export function resolveRecurrenceAnchor(
  recurrence: ItemRecurrence,
  metadata: Record<string, unknown>,
  createdAt: string,
): string {
  if (recurrence.anchor_date) {
    const k = toDateKey(recurrence.anchor_date);
    if (k) return k;
  }
  const due = metadata.due_date as string | undefined;
  if (due) {
    const k = toDateKey(due);
    if (k) return k;
  }
  const renewal = metadata.renewal_date as string | undefined;
  if (renewal) {
    const k = toDateKey(renewal);
    if (k) return k;
  }
  return toDateKey(createdAt) || todayKey();
}

export function formatRecurrenceInterval(interval: RecurrenceInterval): string {
  switch (interval) {
    case "weekly":
      return "weekly";
    case "monthly":
      return "monthly";
    case "yearly":
      return "yearly";
  }
}
