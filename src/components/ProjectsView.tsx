import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { emit } from "@tauri-apps/api/event";
import { getItemById, insertItem, setItemStatus } from "../lib/db/items";
import { getItemStatus, type ItemStatus } from "../lib/db/itemStatus";
import { todayKey } from "../lib/db/dates";
import {
  formatProjectStatusLabel,
  formatTaskRollupLine,
  getProjectRollupsMap,
  getTasksForProject,
  listProjects,
} from "../lib/db/projects";
import type { Item, ProjectMetadata } from "../lib/db/types";
import { detectTags } from "../lib/tags/keywordTagger";
import { EmptyState } from "./EmptyState";
import { ItemEditForm } from "./ItemEditForm";
import { ProjectComposeMode } from "./ProjectComposeMode";
import { ProjectRelatedSection } from "./ProjectRelatedSection";
import { TaskFocusStartButton } from "./TaskFocusStartButton";
import { TaskScheduleActions } from "./TaskScheduleActions";

interface ProjectsViewProps {
  onToast: (message: string, kind: "success" | "error") => void;
  onNavigateToFocus?: () => void;
  onNavigateToLinkedItem?: (item: Item) => void;
  initialShowAdd?: boolean;
  onInitialShowAddConsumed?: () => void;
  initialSelectedId?: string | null;
  onInitialSelectedConsumed?: () => void;
}

function statusBadge(status: ItemStatus): string {
  if (status === "done") return "text-emerald-400";
  if (status === "archived") return "text-pds-subtle";
  return "text-amber-400";
}

function isTaskOverdue(task: Item): boolean {
  const due = task.metadata.due_date as string | undefined;
  if (!due || getItemStatus(task) !== "active") return false;
  return due < todayKey();
}


function ProjectDetailView({ item }: { item: Item }) {
  const meta = item.metadata as ProjectMetadata;
  const status = meta.status ?? "active";
  const notes = meta.notes?.trim();
  return (
    <ProjectDetailBody
      item={item}
      meta={meta}
      status={status}
      notes={notes}
    />
  );
}

function ProjectDetailBody({
  item,
  meta,
  status,
  notes,
}: {
  item: Item;
  meta: ProjectMetadata;
  status: string;
  notes: string | undefined;
}) {
  const detailRows: { label: string; value: string }[] = [];
  detailRows.push({
    label: "Status",
    value: formatProjectStatusLabel(status),
  });
  if (meta.area?.trim()) {
    detailRows.push({ label: "Area", value: meta.area.trim() });
  }
  if (meta.priority) {
    detailRows.push({ label: "Priority", value: meta.priority });
  }
  if (meta.target_date) {
    detailRows.push({ label: "Target", value: meta.target_date });
  }
  if (meta.started_at) {
    detailRows.push({ label: "Started", value: meta.started_at });
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      {detailRows.length > 0 && (
        <dl className="mt-3 space-y-1.5 text-pds-base">
          {detailRows.map((row) => (
            <div key={row.label} className="flex gap-2">
              <dt className="w-20 shrink-0 text-pds-sm uppercase text-pds-muted">
                {row.label}
              </dt>
              <dd className="text-pds-text">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {notes ? (
        <ProjectNotesBlock notes={notes} />
      ) : (
        <p className="mt-4 text-pds-base text-pds-muted">No notes.</p>
      )}
      {item.tags.length > 0 && (
        <p className="mt-4 text-pds-sm text-pds-muted">{item.tags.join(" ")}</p>
      )}
    </div>
  );
}

function ProjectNotesBlock({ notes }: { notes: string }) {
  return (
    <div className="pds-card mt-4 p-3">
      <h3 className="text-pds-sm font-medium uppercase text-pds-muted">Notes</h3>
      <p className="mt-2 whitespace-pre-wrap text-pds-base leading-relaxed text-pds-text">
        {notes}
      </p>
    </div>
  );
}

function AddTaskToProjectForm({
  projectId,
  onCreated,
  onToast,
}: {
  projectId: string;
  onCreated: () => void;
  onToast: (message: string, kind: "success" | "error") => void;
}) {
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) {
      onToast("Task title is required.", "error");
      return;
    }
    setSaving(true);
    try {
      const tags = [
        ...new Set(["#task", ...detectTags(text)]),
      ].slice(0, 8);
      await insertItem({
        type: "task",
        content: text,
        tags,
        source: "projects-tab",
        metadata: {
          project_id: projectId,
          due_date: dueDate.trim() || null,
          owner: null,
          meeting_id: null,
        },
      });
      await emit("item:saved", {});
      setContent("");
      setDueDate("");
      onCreated();
      onToast("Task added to project.", "success");
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Failed to create task",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="border-b border-pds-border px-3 py-2"
    >
      <p className="text-pds-caption font-medium text-pds-muted">Add task</p>
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={saving}
        placeholder="Task title…"
        className="mt-1 w-full rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-pds-sm text-pds-text"
      />
      <div className="mt-1 flex gap-1">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={saving}
          className="min-w-0 flex-1 rounded border border-pds-border bg-pds-panel px-2 py-1 text-pds-caption text-pds-text"
        />
        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="shrink-0 pds-btn-primary px-2 py-1 text-pds-caption font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </form>
  );
}

export function ProjectsView({
  onToast,
  onNavigateToFocus,
  onNavigateToLinkedItem,
  initialShowAdd = false,
  onInitialShowAddConsumed,
  initialSelectedId = null,
  onInitialSelectedConsumed,
}: ProjectsViewProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [rollups, setRollups] = useState<
    Awaited<ReturnType<typeof getProjectRollupsMap>>
  >(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [linkedTasks, setLinkedTasks] = useState<Item[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ItemStatus | "all">("active");
  const [composeKey, setComposeKey] = useState(0);
  const [taskBusyId, setTaskBusyId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Item | null>(null);

  useEffect(() => {
    if (initialShowAdd) {
      setSelectedId(null);
      setComposeKey((k) => k + 1);
      onInitialShowAddConsumed?.();
    }
  }, [initialShowAdd, onInitialShowAddConsumed]);

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
      onInitialSelectedConsumed?.();
    }
  }, [initialSelectedId, onInitialSelectedConsumed]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listProjects({ status, limit: 500 });
      setItems(rows);
      setRollups(await getProjectRollupsMap(rows.map((r) => r.id)));
      if (selectedId) {
        const item = await getItemById(selectedId);
        setSelectedItem(item);
        if (item?.type === "project") {
          setLinkedTasks(await getTasksForProject(item.id));
        } else {
          setLinkedTasks([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [selectedId, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedItem(null);
      setLinkedTasks([]);
      setEditing(false);
      setSelectedTaskId(null);
      setSelectedTask(null);
      return;
    }
    setSelectedTaskId(null);
    setSelectedTask(null);
    void getItemById(selectedId).then(async (item) => {
      setSelectedItem(item);
      if (item?.type === "project") {
        setLinkedTasks(await getTasksForProject(item.id));
      } else {
        setLinkedTasks([]);
      }
    });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedTaskId) {
      setSelectedTask(null);
      return;
    }
    void getItemById(selectedTaskId).then(setSelectedTask);
  }, [selectedTaskId]);

  useEffect(() => {
    const unlisten = listen("item:saved", () => {
      void refresh();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refresh]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? items.filter((item) => {
        const meta = item.metadata;
        const haystack = [
          item.content,
          meta.notes,
          meta.area,
          meta.status,
          meta.priority,
          meta.target_date,
          item.tags.join(" "),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : items;

  function startNewProject() {
    setSelectedId(null);
    setSelectedItem(null);
    setLinkedTasks([]);
    setEditing(false);
    setSelectedTaskId(null);
    setSelectedTask(null);
    setComposeKey((k) => k + 1);
  }

  function handleComposeSaved(item: Item) {
    setSelectedId(item.id);
    setEditing(false);
    void refresh();
  }

  function handleLinkedItemNavigate(item: Item) {
    if (item.type === "project") {
      setEditing(false);
      setSelectedId(item.id);
      return;
    }
    onNavigateToLinkedItem?.(item);
  }

  function clearTaskSelection() {
    setSelectedTaskId(null);
    setSelectedTask(null);
  }

  function handleTaskSelect(taskId: string) {
    if (selectedTaskId === taskId) {
      clearTaskSelection();
      return;
    }
    setSelectedTaskId(taskId);
  }

  async function handleTaskStatus(task: Item, next: ItemStatus) {
    setTaskBusyId(task.id);
    try {
      await setItemStatus(task.id, next);
      await emit("item:saved", {});
      if (selectedItem?.type === "project") {
        const tasks = await getTasksForProject(selectedItem.id);
        setLinkedTasks(tasks);
        if (selectedTaskId) {
          const fresh = tasks.find((t) => t.id === selectedTaskId);
          if (fresh) setSelectedTask(fresh);
        }
      }
      onToast(
        next === "done" ? "Task marked done." : "Task restored.",
        "success",
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Failed to update task",
        "error",
      );
    } finally {
      setTaskBusyId(null);
    }
  }

  const projectDetail =
    selectedItem?.type === "project" ? selectedItem : null;

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-pds-border">
        <div className="border-b border-pds-border px-3 py-3">
          <h2 className="text-pds-base font-semibold text-pds-text">Projects</h2>
          <p className="text-pds-caption text-pds-muted">
            Initiatives, targets, and linked tasks
          </p>
          <button
            type="button"
            onClick={startNewProject}
            className="mt-2 w-full pds-btn-primary px-2 py-1.5 text-pds-sm font-medium text-white"
          >
            New project
          </button>
        </div>
        <div className="space-y-2 border-b border-pds-border px-3 py-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="w-full rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-pds-sm text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
          />
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["active", "Active"],
                ["done", "Done"],
                ["archived", "Archived"],
                ["all", "All"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`rounded px-2 py-0.5 text-pds-caption ${
                  status === value
                    ? "bg-pds-accent text-pds-accent-fg"
                    : "bg-pds-chip text-pds-chip-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-auto p-2">
          {loading && (
            <li className="px-2 py-4 text-pds-sm text-pds-muted">Loading…</li>
          )}
          {error && (
            <li className="rounded border border-red-900/50 bg-red-950/40 px-2 py-2 text-pds-sm text-red-300">
              {error}
            </li>
          )}
          {!loading && !error && filtered.length === 0 && (
            <li className="px-2 py-2">
              <EmptyState
                title="No projects yet"
                description="Create a project to track goals and linked tasks."
                className="py-6"
              >
                <button
                  type="button"
                  onClick={startNewProject}
                  className="pds-btn-primary px-3 py-1.5 text-pds-sm font-medium text-white"
                >
                  New project
                </button>
              </EmptyState>
            </li>
          )}
          {filtered.map((item) => {
            const selected = selectedId === item.id;
            const meta = item.metadata as ProjectMetadata;
            const projectStatus = meta.status ?? "active";
            const rollup = rollups.get(item.id);
            const rollupLine = rollup ? formatTaskRollupLine(rollup) : null;
            const notesPreview = meta.notes?.trim();
            return (
              <li key={item.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setSelectedId(item.id);
                  }}
                  className={`w-full px-2 py-2 text-left text-pds-sm transition ${
                    selected
                      ? "pds-list-item-selected text-pds-text"
                      : "pds-list-item text-pds-text"
                  }`}
                >
                  <p className="font-medium leading-snug">{item.content}</p>
                  {notesPreview && (
                    <p className="mt-0.5 line-clamp-2 text-pds-caption text-pds-muted">
                      {notesPreview.length > 60
                        ? `${notesPreview.slice(0, 60)}…`
                        : notesPreview}
                    </p>
                  )}
                  <p className="mt-1 text-pds-caption text-pds-subtle">
                    {formatProjectStatusLabel(projectStatus)}
                    {rollupLine ? ` · ${rollupLine}` : ""}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto border-r border-pds-border">
        <div
          key={`${selectedId ?? "compose"}-${editing ? "edit" : "view"}`}
          className="pds-view-enter flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {selectedId == null ? (
            <ProjectComposeMode
              key={composeKey}
              onSaved={handleComposeSaved}
              onToast={onToast}
            />
          ) : !selectedItem ? (
            <p className="p-4 text-pds-base text-pds-muted">Loading…</p>
          ) : editing ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <ItemEditForm
                item={selectedItem}
                onSaved={(updated) => {
                  setEditing(false);
                  setSelectedId(updated.id);
                  void refresh();
                }}
                onCancel={() => setEditing(false)}
                onToast={onToast}
                onNavigateToFocus={onNavigateToFocus}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <DetailHeader
                item={selectedItem}
                onEdit={() => setEditing(true)}
              />
              <ProjectDetailView item={selectedItem} />
            </div>
          )}
        </div>
      </main>

      {projectDetail && (
        <aside className="flex w-80 shrink-0 flex-col border-l border-pds-border">
          <div className="border-b border-pds-border p-3">
            <h3 className="text-pds-sm font-medium uppercase tracking-wide text-pds-muted">
              Linked tasks
            </h3>
            <p className="mt-0.5 text-pds-caption text-pds-subtle">
              {linkedTasks.length} task{linkedTasks.length === 1 ? "" : "s"}
            </p>
          </div>
          <AddTaskToProjectForm
            projectId={projectDetail.id}
            onCreated={() => void refresh()}
            onToast={onToast}
          />
          <ul
            className={`min-h-0 overflow-auto p-2 ${
              selectedTaskId
                ? "max-h-[42%] shrink-0"
                : onNavigateToLinkedItem
                  ? "max-h-[40%] shrink-0"
                  : "flex-1"
            }`}
          >
            {linkedTasks.length === 0 && (
              <li className="px-2 py-4 text-pds-caption text-pds-muted">
                No linked tasks yet. Add one above.
              </li>
            )}
            {linkedTasks.map((task) => {
              const taskStatus = getItemStatus(task);
              const overdue = isTaskOverdue(task);
              const busy = taskBusyId === task.id;
              return (
                <li key={task.id} className="mb-2">
                  <div
                    className={`pds-card px-2 py-2 text-pds-sm ${
                      selectedTaskId === task.id ? "pds-list-item-selected" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleTaskSelect(task.id)}
                      className="w-full text-left"
                    >
                      <p className="leading-snug text-pds-text">
                        {task.content.slice(0, 80)}
                        {task.content.length > 80 ? "…" : ""}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-1 text-pds-caption">
                        <span className={statusBadge(taskStatus)}>
                          {taskStatus}
                        </span>
                        {overdue && (
                          <span className="text-red-400">overdue</span>
                        )}
                        {(task.metadata.due_date as string | undefined) && (
                          <span className="text-pds-subtle">
                            due {String(task.metadata.due_date)}
                          </span>
                        )}
                      </p>
                    </button>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {taskStatus === "active" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleTaskStatus(task, "done")}
                          className="rounded bg-emerald-800/50 px-2 py-0.5 text-pds-caption text-emerald-200 disabled:opacity-40"
                        >
                          Done
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleTaskStatus(task, "active")}
                          className="rounded border border-pds-border px-2 py-0.5 text-pds-caption text-pds-muted disabled:opacity-40"
                        >
                          Restore
                        </button>
                      )}
                      <TaskFocusStartButton
                        task={task}
                        onNavigateToFocus={onNavigateToFocus}
                        className="pds-btn-primary-muted px-2 py-0.5 text-pds-caption"
                      />
                      {taskStatus === "active" && (
                        <TaskScheduleActions
                          task={task}
                          onChanged={() => void refresh()}
                          onToast={onToast}
                        />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {!selectedTaskId && onNavigateToLinkedItem && (
            <ProjectRelatedSection
              embedded
              project={projectDetail}
              onNavigateToItem={handleLinkedItemNavigate}
              onToast={onToast}
              onChanged={() => void refresh()}
            />
          )}
          {selectedTaskId && (
            <div className="flex min-h-0 flex-1 flex-col border-t border-pds-border">
              <div className="flex items-center justify-between gap-2 border-b border-pds-border px-3 py-2">
                <h4 className="text-pds-sm font-medium uppercase tracking-wide text-pds-muted">
                  Edit task
                </h4>
                <button
                  type="button"
                  onClick={clearTaskSelection}
                  className="rounded border border-pds-border px-2 py-0.5 text-pds-caption text-pds-muted hover:bg-pds-chip"
                  aria-label="Close task editor"
                >
                  Close
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                {!selectedTask ? (
                  <p className="p-3 text-pds-sm text-pds-muted">Loading…</p>
                ) : (
                  <ItemEditForm
                    item={selectedTask}
                    onSaved={(updated) => {
                      setSelectedTask(updated);
                      void refresh();
                    }}
                    onCancel={clearTaskSelection}
                    onToast={onToast}
                    onNavigateToFocus={onNavigateToFocus}
                  />
                )}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function DetailHeader({
  item,
  onEdit,
}: {
  item: Item;
  onEdit: () => void;
}) {
  const meta = item.metadata as ProjectMetadata;
  const projectStatus = meta.status ?? "active";
  return (
    <div className="border-b border-pds-border px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-pds-base font-semibold text-pds-text">{item.content}</h2>
          <p className="mt-0.5 text-pds-sm text-pds-muted">
            project · {formatProjectStatusLabel(projectStatus)}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded border border-pds-border px-3 py-1 text-pds-sm text-pds-muted hover:bg-pds-chip"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
