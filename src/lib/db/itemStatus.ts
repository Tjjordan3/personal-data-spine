import type { Item } from "./types";

export type ItemStatus = "active" | "done" | "archived";

export function getItemStatus(item: Item): ItemStatus {
  const status = item.metadata.status;
  if (status === "done" || status === "archived") {
    return status;
  }
  return "active";
}

export function isActive(item: Item): boolean {
  return getItemStatus(item) === "active";
}
