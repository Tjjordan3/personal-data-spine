/** Local calendar date as YYYY-MM-DD (no timezone shift for date-only fields). */
export function toDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateKey(dt);
}

export function daysBetweenKeys(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1).getTime();
  const b = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Add calendar months; clamps day when target month is shorter (e.g. Jan 31 → Feb 28). */
export function addMonthsToKey(dateKey: string, months: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const targetMonthIndex = m - 1 + months;
  const lastDay = new Date(y, targetMonthIndex + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  return toDateKey(new Date(y, targetMonthIndex, day));
}

/** Add calendar years; clamps Feb 29 when the target year is not a leap year. */
export function addYearsToKey(dateKey: string, years: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const targetYear = y + years;
  const lastDay = new Date(targetYear, m, 0).getDate();
  const day = Math.min(d, lastDay);
  return toDateKey(new Date(targetYear, m - 1, day));
}

export type RenewalCadence = "weekly" | "monthly" | "yearly";

/** Next renewal on or after `fromKey` for the given cadence (defaults to today). */
export function nextRenewalDateKey(
  cadence: RenewalCadence,
  fromKey: string = todayKey(),
): string {
  switch (cadence) {
    case "weekly":
      return addDaysToKey(fromKey, 7);
    case "monthly":
      return addMonthsToKey(fromKey, 1);
    case "yearly":
      return addYearsToKey(fromKey, 1);
  }
}
