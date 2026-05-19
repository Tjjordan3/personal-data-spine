import type { MeetingTemplate } from "./templates";

const STORAGE_KEY = "pds-meeting-user-templates";

export function loadUserMeetingTemplates(): MeetingTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MeetingTemplate[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t) =>
        t &&
        typeof t.id === "string" &&
        typeof t.label === "string" &&
        typeof t.body === "string",
    );
  } catch {
    return [];
  }
}

export function saveUserMeetingTemplate(template: MeetingTemplate): void {
  const existing = loadUserMeetingTemplates();
  const next = [
    template,
    ...existing.filter((t) => t.id !== template.id),
  ].slice(0, 12);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function meetingBodyAsTemplate(
  meetingContent: string,
  title?: string | null,
): MeetingTemplate {
  const label =
    title?.trim() ||
    meetingContent
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40) ||
    "Saved template";
  return {
    id: `user-${crypto.randomUUID()}`,
    label,
    body: meetingContent,
  };
}
