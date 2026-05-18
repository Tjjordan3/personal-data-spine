import { daysBetweenKeys, todayKey, toDateKey } from "./dates";
import { getItemStatus, type ItemStatus } from "./itemStatus";
import { listItems } from "./items";
import type { Item, ProjectMetadata, ProjectPriority, ProjectStatus } from "./types";

export interface ProjectTaskRollup {
  open: number;
  overdue: number;
}

export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] =
  [
    { value: "active", label: "Active" },
    { value: "planning", label: "Planning" },
    { value: "on_hold", label: "On hold" },
    { value: "done", label: "Done" },
    { value: "archived", label: "Archived" },
  ];

export const PROJECT_PRIORITY_OPTIONS: {
  value: ProjectPriority;
  label: string;
}[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const PROJECT_AREA_PRESETS = [
  "work",
  "home",
  "health",
  "learning",
  "finance",
] as const;

function projectStatusValue(item: Item): string {
  return (item.metadata.status as string | undefined) ?? "active";
}

/** List filter: active = not done/archived; matches on_hold & planning under Active. */
export function matchesProjectListStatus(
  item: Item,
  filter: ItemStatus | "all",
): boolean {
  if (filter === "all") return true;
  const s = projectStatusValue(item);
  if (filter === "done") return s === "done";
  if (filter === "archived") return s === "archived";
  return s !== "done" && s !== "archived";
}

export async function listProjects(options?: {
  status?: ItemStatus | "all";
  limit?: number;
}): Promise<Item[]> {
  const rows = await listItems({
    type: "project",
    status: "all",
    limit: options?.limit ?? 500,
  });
  const filter = options?.status ?? "active";
  return rows.filter((item) => matchesProjectListStatus(item, filter));
}

export async function listActiveProjectsForPicker(): Promise<Item[]> {
  const rows = await listProjects({ status: "active", limit: 200 });
  return rows.filter((item) => {
    const s = projectStatusValue(item);
    return s === "active" || s === "planning";
  });
}

export async function getTasksForProject(projectId: string): Promise<Item[]> {
  const tasks = await listItems({ type: "task", status: "all", limit: 500 });
  return tasks.filter(
    (t) => (t.metadata.project_id as string | undefined) === projectId,
  );
}

export function computeTaskRollup(tasks: Item[]): ProjectTaskRollup {
  const today = todayKey();
  let open = 0;
  let overdue = 0;
  for (const task of tasks) {
    if (getItemStatus(task) !== "active") continue;
    open += 1;
    const due = task.metadata.due_date as string | undefined;
    if (due) {
      const key = toDateKey(due);
      if (key && daysBetweenKeys(today, key) < 0) overdue += 1;
    }
  }
  return { open, overdue };
}

export async function getProjectTaskRollup(
  projectId: string,
): Promise<ProjectTaskRollup> {
  const tasks = await getTasksForProject(projectId);
  return computeTaskRollup(tasks);
}

export async function getProjectRollupsMap(
  projectIds: string[],
): Promise<Map<string, ProjectTaskRollup>> {
  if (projectIds.length === 0) return new Map();
  const tasks = await listItems({ type: "task", status: "all", limit: 2000 });
  const idSet = new Set(projectIds);
  const byProject = new Map<string, Item[]>();
  for (const task of tasks) {
    const pid = task.metadata.project_id as string | undefined;
    if (!pid || !idSet.has(pid)) continue;
    const list = byProject.get(pid) ?? [];
    list.push(task);
    byProject.set(pid, list);
  }
  const result = new Map<string, ProjectTaskRollup>();
  for (const id of projectIds) {
    result.set(id, computeTaskRollup(byProject.get(id) ?? []));
  }
  return result;
}

/** Focus stream: active or planning projects only. */
export function isFocusEligibleProject(item: Item): boolean {
  if (item.type !== "project") return false;
  if (getItemStatus(item) !== "active") return false;
  const s = projectStatusValue(item);
  return s === "active" || s === "planning" || s === "";
}

export function getProjectActivityIso(item: Item): string {
  const meta = item.metadata as ProjectMetadata;
  return meta.updated_at ?? item.created_at;
}

export function projectStalenessDays(item: Item): number | null {
  const key = toDateKey(getProjectActivityIso(item));
  if (!key) return null;
  const days = daysBetweenKeys(key, todayKey());
  return days > 30 ? days : null;
}

export function formatTaskRollupLine(rollup: ProjectTaskRollup): string | null {
  if (rollup.open === 0 && rollup.overdue === 0) return null;
  const parts: string[] = [];
  parts.push(`${rollup.open} open`);
  if (rollup.overdue > 0) {
    parts.push(`${rollup.overdue} overdue`);
  }
  return parts.join(" · ");
}

export function formatProjectStatusLabel(status: string): string {
  const found = PROJECT_STATUS_OPTIONS.find((o) => o.value === status);
  if (found) return found.label;
  return status.replace(/_/g, " ");
}
