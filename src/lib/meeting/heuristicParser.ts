import {
  addDays,
  format,
  isValid,
  nextFriday,
  parse,
  startOfWeek,
} from "date-fns";
import type { ParsedAction } from "./types";

const ACTION_LINE =
  /^(?:(?:[-*•]\s*|\d+[.)]\s*)(?:(?:ACTION|TODO|TASK)\s*:\s*)?|(?:ACTION|TODO|TASK)\s*:\s*)(.+)$/i;

const DECISION_LINE =
  /^(?:[-*•]\s*|\d+[.)]\s*)?(?:DECISION)\s*:\s*(.+)$/i;

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
  /\bon\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\bby\s+(tomorrow|today|eow|end of week|next week)\b/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(tomorrow|today|eow|end of week|next week)\b/i,
];

const DATE_FORMATS = [
  "yyyy-MM-dd",
  "M/d/yyyy",
  "M/d/yy",
  "MM/dd/yyyy",
];

export interface ParseMeetingResult {
  actions: ParsedAction[];
  decisions: string[];
}

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

function weekdayToDate(weekday: string, from: Date): string {
  const dayIndex = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ].indexOf(weekday.toLowerCase());
  const current = from.getDay();
  let delta = dayIndex - current;
  if (delta <= 0) delta += 7;
  return format(addDays(from, delta), "yyyy-MM-dd");
}

function relativePhraseToDate(phrase: string, from: Date): string | null {
  const p = phrase.toLowerCase();
  if (p === "today") return format(from, "yyyy-MM-dd");
  if (p === "tomorrow") return format(addDays(from, 1), "yyyy-MM-dd");
  if (p === "eow" || p === "end of week") {
    const fri = nextFriday(from);
    return format(fri <= from ? addDays(fri, 7) : fri, "yyyy-MM-dd");
  }
  if (p === "next week") {
    return format(addDays(startOfWeek(from, { weekStartsOn: 1 }), 7), "yyyy-MM-dd");
  }
  const weekdays = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  if (weekdays.includes(p)) return weekdayToDate(p, from);
  return null;
}

function extractDueDate(line: string): { line: string; due: string | null } {
  const today = new Date();
  for (const pattern of DUE_PATTERNS) {
    const match = line.match(pattern);
    if (!match) continue;

    const candidate = match[1];
    const relative = relativePhraseToDate(candidate, today);
    if (relative) {
      const cleaned = line.replace(match[0], "").trim();
      return { line: cleaned, due: relative };
    }

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
      const cleaned = line.replace(match[0], "").trim();
      return { line: cleaned, due: weekdayToDate(weekday, today) };
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

export function parseMeetingNotes(text: string): ParseMeetingResult {
  const lines = text.split(/\r?\n/);
  const actions: ParsedAction[] = [];
  const decisions: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const decisionMatch = line.match(DECISION_LINE);
    if (decisionMatch) {
      const decisionText = normalizeActionText(decisionMatch[1]);
      if (decisionText) decisions.push(decisionText);
      continue;
    }

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
      project_id: null,
    });
  }

  return { actions, decisions };
}

/** @deprecated Use parseMeetingNotes which returns decisions too */
export function parseMeetingNotesActionsOnly(text: string): ParsedAction[] {
  return parseMeetingNotes(text).actions;
}
