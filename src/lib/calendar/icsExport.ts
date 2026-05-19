import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { listItems } from "../db/items";
import { isActive } from "../db/itemStatus";
import { toDateKey } from "../db/dates";
import type { Item } from "../db/types";

function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function dateOnlyToIcal(dateKey: string): string {
  const key = toDateKey(dateKey);
  if (!key) return "";
  return key.replace(/-/g, "");
}

function buildVevent(task: Item): string | null {
  const due = task.metadata.due_date as string | undefined;
  if (!due || !isActive(task)) return null;
  const dtstart = dateOnlyToIcal(due);
  if (!dtstart) return null;

  const summary = escapeIcalText(
    task.content.replace(/\s+/g, " ").trim().slice(0, 500) || "Task",
  );
  const descriptionParts: string[] = [];
  const owner = task.metadata.owner as string | undefined;
  if (owner?.trim()) descriptionParts.push(`Owner: ${owner.trim()}`);
  if (task.tags.length > 0) {
    descriptionParts.push(`Tags: ${task.tags.join(", ")}`);
  }
  const description =
    descriptionParts.length > 0
      ? `DESCRIPTION:${escapeIcalText(descriptionParts.join("\n"))}\r\n`
      : "";

  const uid = `pds-task-${task.id}@donepath.local`;
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `SUMMARY:${summary}`,
    description.trimEnd(),
    "END:VEVENT",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function buildIcsCalendar(tasks: Item[]): string {
  const events = tasks
    .map(buildVevent)
    .filter((e): e is string => Boolean(e));
  const body = events.join("\r\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DonePath//Personal Data Spine//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    body,
    "END:VCALENDAR",
  ].join("\r\n");
}

export async function exportTasksIcs(
  suggestedName = "donepath_tasks.ics",
): Promise<{ path: string; count: number } | null> {
  const tasks = await listItems({ type: "task", status: "active", limit: 5000 });
  const withDue = tasks.filter((t) => {
    const due = t.metadata.due_date as string | undefined;
    return Boolean(due?.trim()) && isActive(t);
  });
  if (withDue.length === 0) {
    return { path: "", count: 0 };
  }

  const path = await save({
    title: "Export calendar (.ics)",
    defaultPath: suggestedName,
    filters: [{ name: "iCalendar", extensions: ["ics"] }],
  });
  if (!path) return null;

  const ics = buildIcsCalendar(withDue);
  await writeTextFile(path, ics);
  return { path, count: withDue.length };
}
