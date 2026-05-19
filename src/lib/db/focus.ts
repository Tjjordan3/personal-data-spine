import { getItemById, listItems } from "./items";
import { meetingTitle } from "../meeting/display";
import { loadFocusTimerStats } from "./workBlocks";
import { addDaysToKey, daysBetweenKeys, todayKey, toDateKey } from "./dates";
import {
  formatRecurrenceInterval,
  nextOccurrenceOnOrAfter,
  parseRecurrence,
  resolveRecurrenceAnchor,
  type ItemRecurrence,
} from "../recurrence";
import {
  formatProjectStatusLabel,
  getProjectActivityIso,
  getProjectRollupsMap,
  isFocusEligibleProject,
  projectStalenessDays,
} from "./projects";
import type { Item, ProjectMetadata } from "./types";

export type FocusKind = "task" | "subscription" | "project";

export type FocusUrgency =
  | "overdue"
  | "today"
  | "soon"
  | "active";

export type FocusLinkedView = "projects" | "meetings";

export interface FocusLinkedContext {
  label: string;
  view: FocusLinkedView;
  id: string;
}

export interface FocusEntry {
  item: Item;
  kind: FocusKind;
  urgency: FocusUrgency;
  sortKey: number;
  detail: string;
  /** Next recurrence occurrence (not a duplicate row for static due_date). */
  isRecurrenceLine?: boolean;
  /** Project and/or meeting context for tasks (v7 spine). */
  linkedContexts?: FocusLinkedContext[];
}

export interface FocusSummary {
  tasksDue: number;
  subscriptionsRenewing: number;
  activeProjects: number;
  projectsDueSoon: number;
  focusMinutesToday: number;
  streakDays: number;
}

const SOON_DAYS = 7;

function isTaskSnoozed(item: Item, today: string): boolean {
  const until = item.metadata.snoozed_until as string | undefined;
  if (!until) return false;
  const key = toDateKey(until);
  if (!key) return false;
  return key >= today;
}

function urgencySort(urgency: FocusUrgency): number {
  switch (urgency) {
    case "overdue":
      return 0;
    case "today":
      return 1;
    case "soon":
      return 2;
    case "active":
      return 3;
    default:
      return 4;
  }
}

function classifyDateKey(
  dateKey: string,
  today: string,
): FocusUrgency | null {
  if (!dateKey) return null;
  const diff = daysBetweenKeys(today, dateKey);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= SOON_DAYS) return "soon";
  return null;
}

function taskDueDetail(item: Item, urgency: FocusUrgency): string {
  const due = item.metadata.due_date as string | undefined;
  const key = due ? toDateKey(due) : "";
  if (urgency === "overdue") return `Overdue · due ${key}`;
  if (urgency === "today") return "Due today";
  if (urgency === "soon") return `Due ${key}`;
  return "Task";
}

function recurringDetail(
  kind: "task" | "subscription",
  recurrence: ItemRecurrence,
  nextKey: string,
  urgency: FocusUrgency,
): string {
  const interval = formatRecurrenceInterval(recurrence.interval);
  const prefix = kind === "task" ? "Recurring task" : "Recurring renewal";
  if (urgency === "overdue") {
    return `${prefix} (${interval}) · overdue · next ${nextKey}`;
  }
  if (urgency === "today") {
    return `${prefix} (${interval}) · due today`;
  }
  if (urgency === "soon") {
    return `${prefix} (${interval}) · next ${nextKey}`;
  }
  return `${prefix} (${interval})`;
}

function subscriptionDetail(item: Item, urgency: FocusUrgency): string {
  const renewal = item.metadata.renewal_date as string | undefined;
  const key = renewal ? toDateKey(renewal) : "";
  const amount = item.metadata.amount as number | string | undefined;
  const cadence = item.metadata.cadence as string | undefined;
  const parts: string[] = [];
  if (urgency === "overdue") parts.push("Renewal overdue");
  else if (urgency === "today") parts.push("Renews today");
  else if (urgency === "soon") parts.push(`Renews ${key}`);
  if (amount != null && amount !== "") parts.push(`$${amount}`);
  if (cadence) parts.push(cadence);
  return parts.join(" · ") || "Subscription";
}

function projectTargetDetail(item: Item, urgency: FocusUrgency): string {
  const target = (item.metadata as ProjectMetadata).target_date;
  const key = target ? toDateKey(target) : "";
  if (urgency === "overdue") return `Target overdue · ${key}`;
  if (urgency === "today") return "Target today";
  if (urgency === "soon") return `Target ${key}`;
  return "";
}

function projectDetail(
  item: Item,
  urgency: FocusUrgency,
  openTasks: number,
): string {
  const meta = item.metadata as ProjectMetadata;
  const parts: string[] = [];

  const targetPart = projectTargetDetail(item, urgency);
  if (targetPart) parts.push(targetPart);

  const status = meta.status ?? "active";
  parts.push(formatProjectStatusLabel(status));

  if (meta.priority) parts.push(meta.priority);
  if (meta.area?.trim()) parts.push(meta.area.trim());

  if (openTasks > 0) {
    parts.push(`${openTasks} open task${openTasks === 1 ? "" : "s"}`);
  }

  const staleDays = projectStalenessDays(item);
  if (staleDays != null) {
    parts.push(`No activity in ${staleDays} days`);
  }

  return parts.join(" · ") || "Active project";
}

function projectSortDate(item: Item): string {
  const meta = item.metadata as ProjectMetadata;
  if (meta.target_date) return toDateKey(meta.target_date) || meta.target_date;
  return getProjectActivityIso(item);
}

function projectContextLabel(project: Item): string {
  const flat = project.content.replace(/\s+/g, " ").trim();
  return flat.length > 48 ? `${flat.slice(0, 48)}…` : flat || "Project";
}

async function loadTaskLinkedContextMap(
  tasks: Item[],
): Promise<Map<string, FocusLinkedContext[]>> {
  const projectIds = new Set<string>();
  const meetingIds = new Set<string>();
  for (const task of tasks) {
    const pid = (task.metadata.project_id as string | undefined)?.trim();
    const mid = (task.metadata.meeting_id as string | undefined)?.trim();
    if (pid) projectIds.add(pid);
    if (mid) meetingIds.add(mid);
  }

  const projectById = new Map<string, Item>();
  const meetingById = new Map<string, Item>();
  await Promise.all([
    ...[...projectIds].map(async (id) => {
      const p = await getItemById(id);
      if (p) projectById.set(id, p);
    }),
    ...[...meetingIds].map(async (id) => {
      const m = await getItemById(id);
      if (m) meetingById.set(id, m);
    }),
  ]);

  const map = new Map<string, FocusLinkedContext[]>();
  for (const task of tasks) {
    const contexts: FocusLinkedContext[] = [];
    const pid = (task.metadata.project_id as string | undefined)?.trim();
    if (pid && projectById.has(pid)) {
      contexts.push({
        label: projectContextLabel(projectById.get(pid)!),
        view: "projects",
        id: pid,
      });
    }
    const mid = (task.metadata.meeting_id as string | undefined)?.trim();
    if (mid && meetingById.has(mid)) {
      contexts.push({
        label: meetingTitle(meetingById.get(mid)!),
        view: "meetings",
        id: mid,
      });
    }
    if (contexts.length > 0) map.set(task.id, contexts);
  }
  return map;
}

export async function loadFocusStream(): Promise<{
  entries: FocusEntry[];
  summary: FocusSummary;
}> {
  const today = todayKey();
  const soonLimit = addDaysToKey(today, SOON_DAYS);

  const [tasks, subscriptions, projects, timerStats] = await Promise.all([
    listItems({ type: "task", status: "active", limit: 500 }),
    listItems({ type: "subscription", status: "active", limit: 200 }),
    listItems({ type: "project", status: "all", limit: 200 }),
    loadFocusTimerStats(),
  ]);

  const eligibleProjects = projects.filter(isFocusEligibleProject);
  const rollups = await getProjectRollupsMap(
    eligibleProjects.map((p) => p.id),
  );
  const taskLinkedContexts = await loadTaskLinkedContextMap(tasks);

  const entries: FocusEntry[] = [];
  let tasksDue = 0;
  let subscriptionsRenewing = 0;
  let activeProjects = 0;
  let projectsDueSoon = 0;

  for (const item of tasks) {
    if (isTaskSnoozed(item, today)) continue;
    const due = item.metadata.due_date as string | undefined;
    let dueShown = false;
    if (due) {
      const key = toDateKey(due);
      if (key && key <= soonLimit) {
        const urgency = classifyDateKey(key, today);
        if (urgency) {
          tasksDue += 1;
          dueShown = true;
          entries.push({
            item,
            kind: "task",
            urgency,
            sortKey: urgencySort(urgency),
            detail: taskDueDetail(item, urgency),
            linkedContexts: taskLinkedContexts.get(item.id),
          });
        }
      }
    }

    const recurrence = parseRecurrence(item.metadata);
    if (!recurrence) continue;
    const anchor = resolveRecurrenceAnchor(
      recurrence,
      item.metadata,
      item.created_at,
    );
    const nextKey = nextOccurrenceOnOrAfter(anchor, recurrence.interval, today);
    if (!nextKey || nextKey > soonLimit) continue;
    if (dueShown && due) {
      const dueKey = toDateKey(due);
      if (dueKey === nextKey) continue;
    }
    const urgency = classifyDateKey(nextKey, today);
    if (!urgency) continue;
    tasksDue += 1;
    entries.push({
      item,
      kind: "task",
      urgency,
      sortKey: urgencySort(urgency),
      detail: recurringDetail("task", recurrence, nextKey, urgency),
      isRecurrenceLine: true,
      linkedContexts: taskLinkedContexts.get(item.id),
    });
  }

  for (const item of subscriptions) {
    const renewal = item.metadata.renewal_date as string | undefined;
    let renewalShown = false;
    if (renewal) {
      const key = toDateKey(renewal);
      if (key && key <= soonLimit) {
        const urgency = classifyDateKey(key, today);
        if (urgency) {
          subscriptionsRenewing += 1;
          renewalShown = true;
          entries.push({
            item,
            kind: "subscription",
            urgency,
            sortKey: urgencySort(urgency),
            detail: subscriptionDetail(item, urgency),
          });
        }
      }
    }

    const recurrence = parseRecurrence(item.metadata);
    if (!recurrence) continue;
    const anchor = resolveRecurrenceAnchor(
      recurrence,
      item.metadata,
      item.created_at,
    );
    const nextKey = nextOccurrenceOnOrAfter(anchor, recurrence.interval, today);
    if (!nextKey || nextKey > soonLimit) continue;
    if (renewalShown && renewal) {
      const renewalKey = toDateKey(renewal);
      if (renewalKey === nextKey) continue;
    }
    const urgency = classifyDateKey(nextKey, today);
    if (!urgency) continue;
    subscriptionsRenewing += 1;
    entries.push({
      item,
      kind: "subscription",
      urgency,
      sortKey: urgencySort(urgency),
      detail: recurringDetail("subscription", recurrence, nextKey, urgency),
      isRecurrenceLine: true,
    });
  }

  for (const item of eligibleProjects) {
    const meta = item.metadata as ProjectMetadata;
    const target = meta.target_date;
    const rollup = rollups.get(item.id) ?? { open: 0, overdue: 0 };
    const openTasks = rollup.open;

    let urgency: FocusUrgency = "active";
    if (target) {
      const key = toDateKey(target);
      if (key && key <= soonLimit) {
        const classified = classifyDateKey(key, today);
        if (classified) {
          urgency = classified;
          if (classified !== "active") projectsDueSoon += 1;
        }
      }
    }

    activeProjects += 1;

    entries.push({
      item,
      kind: "project",
      urgency,
      sortKey: urgencySort(urgency),
      detail: projectDetail(item, urgency, openTasks),
    });
  }

  entries.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    const dateA =
      (a.item.metadata.due_date as string | undefined) ??
      (a.item.metadata.renewal_date as string | undefined) ??
      (a.kind === "project" ? projectSortDate(a.item) : a.item.created_at);
    const dateB =
      (b.item.metadata.due_date as string | undefined) ??
      (b.item.metadata.renewal_date as string | undefined) ??
      (b.kind === "project" ? projectSortDate(b.item) : b.item.created_at);
    return String(dateA).localeCompare(String(dateB));
  });

  return {
    entries,
    summary: {
      tasksDue,
      subscriptionsRenewing,
      activeProjects,
      projectsDueSoon,
      focusMinutesToday: timerStats.focusMinutesToday,
      streakDays: timerStats.streakDays,
    },
  };
}

export function formatFocusSummary(summary: FocusSummary): string {
  const parts: string[] = [];
  parts.push(
    `${summary.tasksDue} task${summary.tasksDue === 1 ? "" : "s"} due`,
  );
  parts.push(
    `${summary.subscriptionsRenewing} subscription${summary.subscriptionsRenewing === 1 ? "" : "s"} renewing`,
  );
  parts.push(
    `${summary.activeProjects} project${summary.activeProjects === 1 ? "" : "s"}`,
  );
  if (summary.projectsDueSoon > 0) {
    parts.push(
      `${summary.projectsDueSoon} target${summary.projectsDueSoon === 1 ? "" : "s"} soon`,
    );
  }
  parts.push(
    `${summary.focusMinutesToday} min focus today`,
  );
  if (summary.streakDays > 0) {
    parts.push(
      `${summary.streakDays}-day streak`,
    );
  }
  return parts.join(" · ");
}

/** Top task for Focus “Start focus” — overdue/today first, then soon. */
export function pickNextFocusTask(entries: FocusEntry[]): FocusEntry | null {
  const tasks = entries.filter((e) => e.kind === "task" && !e.isRecurrenceLine);
  if (tasks.length === 0) {
    return entries.find((e) => e.kind === "task") ?? null;
  }
  return tasks[0];
}
