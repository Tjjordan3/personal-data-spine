import type { Item } from "../db/types";

export function meetingTitle(item: Item): string {
  const raw = item.metadata.title;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const firstLine = item.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (firstLine && firstLine.length <= 100) return firstLine;
  const flat = item.content.replace(/\s+/g, " ").trim();
  return flat.slice(0, 80) || "Untitled meeting";
}

export function meetingBodyPreview(item: Item, max = 140): string {
  const flat = item.content.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
