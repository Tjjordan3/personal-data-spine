import { parse, isValid, format } from "date-fns";
import type { ParsedAction } from "./types";

const ACTION_LINE =
  /^(?:[-*•]\s*|\d+[.)]\s*|(?:ACTION|TODO|TASK)\s*:\s*)(.+)$/i;

const OWNER_PATTERNS = [
  /@([A-Za-z][\w.-]*)/,
  /\(([^)]+)\)\s*$/,
  /(?:owner|assignee)\s*:\s*([A-Za-z][\w.-]*)/i,
  /(?:—|-)\s*([A-Za-z][\w.-]*)\s*$/,
];

const DUE_PATTERNS = [
  /\bdue\s+(\d{4}-\d{2}-\d{2})\b/i,
  /\bby\s+(\d{4}-\d{2}-\d{2})\b/i,
  /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/,
  /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
];

const DATE_FORMATS = [
  "yyyy-MM-dd",
  "M/d/yyyy",
  "M/d/yy",
  "MM/dd/yyyy",
];

function parseDueDate(raw: string): string | null {
  const trimmed = raw.trim();
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(trimmed, fmt, new Date());
    if (isValid(parsed)) {
      return format(parsed, "yyyy-MM-dd");
    }
  }
  return null;
}

function extractDueDate(line: string): { line: string; due: string | null } {
  for (const pattern of DUE_PATTERNS) {
    const match = line.match(pattern);
    if (!match) continue;

    const candidate = match[1];
    const weekday = candidate.toLowerCase();
    if (
      [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ].includes(weekday)
    ) {
      const today = new Date();
      const dayIndex = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ].indexOf(weekday);
      const current = today.getDay();
      let delta = dayIndex - current;
      if (delta <= 0) delta += 7;
      const target = new Date(today);
      target.setDate(today.getDate() + delta);
      const cleaned = line.replace(match[0], "").trim();
      return { line: cleaned, due: format(target, "yyyy-MM-dd") };
    }

    const due = parseDueDate(candidate);
    if (due) {
      const cleaned = line.replace(match[0], "").trim();
      return { line: cleaned, due };
    }
  }
  return { line, due: null };
}

function extractOwner(line: string): { line: string; owner: string | null } {
  for (const pattern of OWNER_PATTERNS) {
    const match = line.match(pattern);
    if (!match) continue;
    const owner = match[1].trim();
    const cleaned = line.replace(match[0], "").trim();
    return { line: cleaned, owner };
  }
  return { line, owner: null };
}

function normalizeActionText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function parseMeetingNotes(text: string): ParsedAction[] {
  const lines = text.split(/\r?\n/);
  const actions: ParsedAction[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(ACTION_LINE);
    if (!match) continue;

    let actionText = match[1].trim();
    const { line: afterDue, due } = extractDueDate(actionText);
    actionText = afterDue;
    const { line: afterOwner, owner } = extractOwner(actionText);
    actionText = normalizeActionText(afterOwner);

    if (!actionText) continue;

    actions.push({
      id: crypto.randomUUID(),
      text: actionText,
      owner,
      due_date: due,
    });
  }

  return actions;
}
