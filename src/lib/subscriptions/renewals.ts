import { addDaysToKey, daysBetweenKeys, todayKey, toDateKey } from "../db/dates";
import type { Item } from "../db/types";

/** Matches Focus stream and search “due soon” window. */
export const RENEWAL_SOON_DAYS = 7;

export type RenewalUrgency = "overdue" | "today" | "soon";

export function renewalDateKey(item: Item): string | null {
  const renewal = item.metadata.renewal_date as string | undefined;
  if (!renewal) return null;
  const key = toDateKey(renewal);
  return key || null;
}

export function classifyRenewal(
  renewalKey: string,
  today: string = todayKey(),
): RenewalUrgency | null {
  const diff = daysBetweenKeys(today, renewalKey);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= RENEWAL_SOON_DAYS) return "soon";
  return null;
}

export function isRenewalDueForReminder(
  renewalKey: string,
  today: string = todayKey(),
): boolean {
  const limit = addDaysToKey(today, RENEWAL_SOON_DAYS);
  return renewalKey <= limit;
}

export function renewalUrgencyLabel(urgency: RenewalUrgency): string {
  switch (urgency) {
    case "overdue":
      return "Overdue";
    case "today":
      return "Renews today";
    case "soon":
      return "Due soon";
  }
}

export function renewalListHint(
  renewalKey: string,
  today: string = todayKey(),
): string | null {
  const urgency = classifyRenewal(renewalKey, today);
  if (!urgency) return null;
  if (urgency === "overdue") {
    const days = Math.abs(daysBetweenKeys(today, renewalKey));
    return days === 1 ? "1 day overdue" : `${days} days overdue`;
  }
  if (urgency === "today") return "Renews today";
  const days = daysBetweenKeys(today, renewalKey);
  return days === 1 ? "Renews tomorrow" : `Renews in ${days}d`;
}

export function renewalNotificationBody(
  item: Item,
  renewalKey: string,
  today: string = todayKey(),
): string {
  const urgency = classifyRenewal(renewalKey, today);
  const amount = item.metadata.amount as number | string | undefined;
  const cadence = item.metadata.cadence as string | undefined;
  const parts: string[] = [];
  if (urgency === "overdue") {
    const days = Math.abs(daysBetweenKeys(today, renewalKey));
    parts.push(
      days === 1 ? "Renewal was yesterday" : `Renewal overdue (${days} days)`,
    );
  } else if (urgency === "today") {
    parts.push("Renews today");
  } else {
    const days = daysBetweenKeys(today, renewalKey);
    parts.push(
      days === 1 ? "Renews tomorrow" : `Renews in ${days} days (${renewalKey})`,
    );
  }
  if (amount != null && amount !== "") parts.push(`$${amount}`);
  if (cadence) parts.push(String(cadence));
  return parts.join(" · ");
}

export function renewalNotifyDedupeKey(itemId: string, renewalKey: string): string {
  return `${itemId}:${renewalKey}`;
}
