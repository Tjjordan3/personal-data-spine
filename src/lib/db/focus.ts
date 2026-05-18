import { listItems } from "./items";
import { loadFocusTimerStats } from "./workBlocks";
import { addDaysToKey, daysBetweenKeys, todayKey, toDateKey } from "./dates";
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

export interface FocusEntry {
  item: Item;
  kind: FocusKind;
  urgency: FocusUrgency;
  sortKey: number;
  detail: string;
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

  const entries: FocusEntry[] = [];
  let tasksDue = 0;
  let subscriptionsRenewing = 0;
  let activeProjects = 0;
  let projectsDueSoon = 0;

  for (const item of tasks) {
    const due = item.metadata.due_date as string | undefined;
    if (!due) continue;
    const key = toDateKey(due);
    if (!key || key > soonLimit) continue;
    const urgency = classifyDateKey(key, today);
    if (!urgency) continue;
    tasksDue += 1;
    entries.push({
      item,
      kind: "task",
      urgency,
      sortKey: urgencySort(urgency),
      detail: taskDueDetail(item, urgency),
    });
  }

  for (const item of subscriptions) {
    const renewal = item.metadata.renewal_date as string | undefined;
    if (!renewal) continue;
    const key = toDateKey(renewal);
    if (!key || key > soonLimit) continue;
    const urgency = classifyDateKey(key, today);
    if (!urgency) continue;
    subscriptionsRenewing += 1;
    entries.push({
      item,
      kind: "subscription",
      urgency,
      sortKey: urgencySort(urgency),
      detail: subscriptionDetail(item, urgency),
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
