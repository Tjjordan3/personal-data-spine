import type { RenewalCadence } from "../db/dates";

export type SubscriptionCadence = RenewalCadence;

const WEEKS_PER_MONTH = 4.33;

/** Convert catalog price (for `baseCadence`) to the amount charged per `targetCadence`. */
export function amountForCadence(
  baseAmount: number,
  baseCadence: SubscriptionCadence,
  targetCadence: SubscriptionCadence,
): number {
  const monthly =
    baseCadence === "monthly"
      ? baseAmount
      : baseCadence === "weekly"
        ? baseAmount * WEEKS_PER_MONTH
        : baseAmount / 12;

  if (targetCadence === "monthly") return monthly;
  if (targetCadence === "weekly") return monthly / WEEKS_PER_MONTH;
  return monthly * 12;
}

export function formatSubscriptionAmount(value: number): string {
  return value.toFixed(2);
}
