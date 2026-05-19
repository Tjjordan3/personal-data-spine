import { getItemById } from "../db/items";
import {
  createBidirectionalLink,
  getLinksForItem,
  linkMeetingTask,
} from "../db/links";
import { meetingTitle } from "../meeting/display";
import type { Item } from "../db/types";

export type LinkSuggestionKind = "meeting" | "project";

export interface LinkSuggestion {
  key: string;
  message: string;
  kind: LinkSuggestionKind;
  apply: () => Promise<void>;
}

async function hasMeetingGraphLink(
  taskId: string,
  meetingId: string,
): Promise<boolean> {
  const links = await getLinksForItem(taskId);
  return links.some(
    (l) =>
      (l.from_id === taskId &&
        l.to_id === meetingId &&
        l.link_type === "action_of") ||
      (l.from_id === meetingId &&
        l.to_id === taskId &&
        l.link_type === "has_action"),
  );
}

async function hasProjectGraphLink(
  taskId: string,
  projectId: string,
): Promise<boolean> {
  const links = await getLinksForItem(taskId);
  return links.some(
    (l) =>
      (l.from_id === taskId && l.to_id === projectId) ||
      (l.from_id === projectId && l.to_id === taskId),
  );
}

function projectLabel(project: Item | null, projectId: string): string {
  if (!project) return projectId.slice(0, 8);
  const flat = project.content.replace(/\s+/g, " ").trim();
  return flat.length > 60 ? `${flat.slice(0, 60)}…` : flat || "Project";
}

/** Suggest graph links after meeting save; never writes links until user accepts. */
export async function buildMeetingSaveLinkSuggestions(
  meeting: Item,
  tasks: Item[],
): Promise<LinkSuggestion[]> {
  const suggestions: LinkSuggestion[] = [];

  const needsMeetingLink: Item[] = [];
  for (const task of tasks) {
    if (!(await hasMeetingGraphLink(task.id, meeting.id))) {
      needsMeetingLink.push(task);
    }
  }
  if (needsMeetingLink.length > 0) {
    const title = meetingTitle(meeting);
    suggestions.push({
      key: `meeting:${meeting.id}`,
      message: `Link ${needsMeetingLink.length} task${needsMeetingLink.length === 1 ? "" : "s"} to meeting “${title}”?`,
      kind: "meeting",
      apply: async () => {
        for (const task of needsMeetingLink) {
          await linkMeetingTask(meeting.id, task.id);
        }
      },
    });
  }

  const byProject = new Map<string, Item[]>();
  for (const task of tasks) {
    const pid = (task.metadata.project_id as string | undefined)?.trim();
    if (!pid) continue;
    const list = byProject.get(pid) ?? [];
    list.push(task);
    byProject.set(pid, list);
  }

  for (const [projectId, projectTasks] of byProject) {
    const needsProjectLink: Item[] = [];
    for (const task of projectTasks) {
      if (!(await hasProjectGraphLink(task.id, projectId))) {
        needsProjectLink.push(task);
      }
    }
    if (needsProjectLink.length === 0) continue;
    const project = await getItemById(projectId);
    const label = projectLabel(project, projectId);
    suggestions.push({
      key: `project:${projectId}`,
      message: `Link ${needsProjectLink.length} task${needsProjectLink.length === 1 ? "" : "s"} to project “${label}”?`,
      kind: "project",
      apply: async () => {
        for (const task of needsProjectLink) {
          await createBidirectionalLink(task.id, projectId, "related", "related");
        }
      },
    });
  }

  return suggestions;
}
