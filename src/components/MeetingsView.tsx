import { useCallback, useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import {
  getItemById,
  getTasksForMeeting,
  listItems,
  setItemStatus,
} from "../lib/db/items";
import { getItemStatus, type ItemStatus } from "../lib/db/itemStatus";
import { todayKey } from "../lib/db/dates";
import { meetingBodyPreview, meetingTitle } from "../lib/meeting/display";
import {
  meetingBodyAsTemplate,
  saveUserMeetingTemplate,
} from "../lib/meeting/userTemplates";
import type { Item } from "../lib/db/types";
import { EmptyState } from "./EmptyState";
import { ItemEditForm } from "./ItemEditForm";
import { MeetingMode } from "./MeetingMode";
import { MeetingPostSavePrompt } from "./MeetingPostSavePrompt";
import { TaskFocusStartButton } from "./TaskFocusStartButton";
import { TaskScheduleActions } from "./TaskScheduleActions";
import type { MeetingSaveResult } from "./MeetingMode";

interface MeetingsViewProps {
  onToast: (message: string, kind: "success" | "error") => void;
  onNavigateToFocus?: () => void;
  initialComposeTemplateId?: string | null;
  onInitialComposeTemplateConsumed?: () => void;
  initialSelectedId?: string | null;
  onInitialSelectedConsumed?: () => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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

export function MeetingsView({
  onToast,
  onNavigateToFocus,
  initialComposeTemplateId = null,
  onInitialComposeTemplateConsumed,
  initialSelectedId = null,
  onInitialSelectedConsumed,
}: MeetingsViewProps) {
  const [meetings, setMeetings] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [linkedTasks, setLinkedTasks] = useState<Item[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composeKey, setComposeKey] = useState(0);
  const [taskBusyId, setTaskBusyId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Item | null>(null);
  const [postSave, setPostSave] = useState<{
    meeting: Item;
    tasks: Item[];
  } | null>(null);
  const [composeTemplateId, setComposeTemplateId] = useState<string | null>(
    initialComposeTemplateId,
  );
  const [composeDuplicateFrom, setComposeDuplicateFrom] = useState<{
    content: string;
    title?: string | null;
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listItems({ type: "meeting", status: "all", limit: 200 });
      setMeetings(rows);
      if (selectedId) {
        const item = await getItemById(selectedId);
        setSelectedItem(item);
        if (item?.type === "meeting") {
          setLinkedTasks(await getTasksForMeeting(item.id));
        } else {
          setLinkedTasks([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

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
      if (item?.type === "meeting") {
        setLinkedTasks(await getTasksForMeeting(item.id));
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

  useEffect(() => {
    if (!initialComposeTemplateId) return;
    setComposeTemplateId(initialComposeTemplateId);
    setSelectedId(null);
    setSelectedItem(null);
    setLinkedTasks([]);
    setEditing(false);
    setPostSave(null);
    setComposeKey((k) => k + 1);
    onInitialComposeTemplateConsumed?.();
  }, [
    initialComposeTemplateId,
    onInitialComposeTemplateConsumed,
  ]);

  useEffect(() => {
    if (!initialSelectedId) return;
    setSelectedId(initialSelectedId);
    setEditing(false);
    setPostSave(null);
    onInitialSelectedConsumed?.();
  }, [initialSelectedId, onInitialSelectedConsumed]);

  function handleSaved(result: MeetingSaveResult) {
    setSelectedId(result.meetingId);
    setEditing(false);
    void getItemById(result.meetingId).then((meeting) => {
      if (meeting) setPostSave({ meeting, tasks: result.tasks });
    });
    void refresh();
  }

  function startNewMeeting() {
    setSelectedId(null);
    setSelectedItem(null);
    setLinkedTasks([]);
    setEditing(false);
    setSelectedTaskId(null);
    setSelectedTask(null);
    setPostSave(null);
    setComposeTemplateId(null);
    setComposeDuplicateFrom(null);
    setComposeKey((k) => k + 1);
  }

  function duplicateLastMeeting() {
    const last = meetings[0];
    if (!last) {
      onToast("No saved meetings to duplicate.", "error");
      return;
    }
    setComposeDuplicateFrom({
      content: last.content,
      title: (last.metadata.title as string | undefined) ?? null,
    });
    setComposeTemplateId(null);
    startNewMeeting();
    onToast("Loaded last meeting structure.", "success");
  }

  function saveMeetingAsTemplate(meeting: Item) {
    const template = meetingBodyAsTemplate(
      meeting.content,
      (meeting.metadata.title as string | undefined) ?? null,
    );
    saveUserMeetingTemplate(template);
    onToast(`Saved template “${template.label}”.`, "success");
  }

  function useMeetingAsCompose(meeting: Item) {
    setComposeDuplicateFrom({
      content: meeting.content,
      title: (meeting.metadata.title as string | undefined) ?? null,
    });
    setSelectedId(null);
    setSelectedItem(null);
    setLinkedTasks([]);
    setEditing(false);
    setComposeKey((k) => k + 1);
    onToast("Meeting loaded for a new note.", "success");
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

  async function handleTaskStatus(task: Item, status: ItemStatus) {
    setTaskBusyId(task.id);
    try {
      await setItemStatus(task.id, status);
      await emit("item:saved", {});
      if (selectedItem?.type === "meeting") {
        const tasks = await getTasksForMeeting(selectedItem.id);
        setLinkedTasks(tasks);
        if (selectedTaskId) {
          const fresh = tasks.find((t) => t.id === selectedTaskId);
          if (fresh) setSelectedTask(fresh);
        }
      }
      onToast(
        status === "done" ? "Task marked done." : "Task restored.",
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

  const meetingDetail =
    selectedItem?.type === "meeting" ? selectedItem : null;
  const decisions =
    meetingDetail &&
    Array.isArray(meetingDetail.metadata.decisions)
      ? (meetingDetail.metadata.decisions as string[])
      : [];

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-pds-border">
        <div className="border-b border-pds-border px-3 py-3">
          <h2 className="text-pds-base font-semibold text-pds-text">Meetings</h2>
          <p className="text-pds-caption text-pds-muted">Saved notes and action items</p>
          <button
            type="button"
            onClick={startNewMeeting}
            className="pds-btn-primary mt-2 w-full px-2 py-1.5 text-pds-sm"
          >
            New meeting
          </button>
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
          {!loading && !error && meetings.length === 0 && (
            <li className="px-2 py-2">
              <EmptyState
                title="No meetings yet"
                description="Capture notes from a sync or 1:1, then parse action items."
                className="py-6"
              >
                <button
                  type="button"
                  onClick={startNewMeeting}
                  className="pds-btn-primary px-3 py-1.5 text-pds-sm"
                >
                  New meeting
                </button>
                {meetings.length > 0 && (
                  <button
                    type="button"
                    onClick={duplicateLastMeeting}
                    className="rounded border border-pds-border px-3 py-1.5 text-pds-sm text-pds-text"
                  >
                    Duplicate last meeting
                  </button>
                )}
              </EmptyState>
            </li>
          )}
          {meetings.map((item) => {
            const selected = selectedId === item.id;
            const status = getItemStatus(item);
            const taskCount =
              typeof item.metadata.task_count === "number"
                ? item.metadata.task_count
                : null;
            return (
              <li key={item.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setPostSave(null);
                    setSelectedId(item.id);
                  }}
                  className={`w-full px-2 py-2 text-left text-pds-sm transition ${
                    selected
                      ? "pds-list-item-selected text-pds-text"
                      : "pds-list-item text-pds-text"
                  }`}
                >
                  <p className="font-medium leading-snug">{meetingTitle(item)}</p>
                  {meetingBodyPreview(item, 60) && (
                    <p className="mt-0.5 text-pds-caption text-pds-muted line-clamp-2">
                      {meetingBodyPreview(item, 60)}
                    </p>
                  )}
                  <p className="mt-1 text-pds-caption text-pds-subtle">
                    {formatTime(item.created_at)}
                    {taskCount != null ? ` · ${taskCount} tasks` : ""}
                    {status !== "active" ? ` · ${status}` : ""}
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
          <MeetingMode
            key={composeKey}
            initialTemplateId={composeTemplateId}
            duplicateFrom={composeDuplicateFrom}
            onSaved={handleSaved}
            onError={(msg) => onToast(msg, "error")}
            onSuccess={(msg) => onToast(msg, "success")}
          />
        ) : !selectedItem ? (
          <p className="p-4 text-pds-base text-pds-muted">Loading…</p>
        ) : editing ? (
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
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {postSave && (
              <MeetingPostSavePrompt
                meeting={postSave.meeting}
                tasks={postSave.tasks}
                onDismiss={() => setPostSave(null)}
                onToast={onToast}
                onNavigateToFocus={onNavigateToFocus}
                onTasksChanged={() => void refresh()}
              />
            )}
            <div className="border-b border-pds-border px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-pds-base font-semibold text-pds-text">
                    {meetingTitle(selectedItem)}
                  </h2>
                  <p className="mt-0.5 text-pds-sm text-pds-muted">
                    meeting
                    {" · "}
                    {formatTime(selectedItem.created_at)}
                    {getItemStatus(selectedItem) !== "active" &&
                      ` · ${getItemStatus(selectedItem)}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => useMeetingAsCompose(selectedItem)}
                    className="rounded border border-pds-border px-2 py-1 text-pds-sm text-pds-muted hover:bg-pds-chip"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => saveMeetingAsTemplate(selectedItem)}
                    className="rounded border border-pds-border px-2 py-1 text-pds-sm text-pds-muted hover:bg-pds-chip"
                  >
                    Save template
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="rounded border border-pds-border px-3 py-1 text-pds-sm text-pds-muted hover:bg-pds-chip"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {selectedItem.content ? (
                    <pre className="whitespace-pre-wrap font-sans text-pds-base leading-relaxed text-pds-text">
                      {selectedItem.content}
                    </pre>
                  ) : (
                    <p className="text-pds-base text-pds-muted">No notes.</p>
                  )}
                  {decisions.length > 0 && (
                    <div className="pds-card mt-4 p-3">
                      <h3 className="text-pds-sm font-medium uppercase text-pds-muted">
                        Decisions
                      </h3>
                      <ul className="mt-2 list-inside list-disc text-pds-base text-pds-text">
                        {decisions.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              {selectedItem.tags.length > 0 && (
                <p className="mt-4 text-pds-sm text-pds-muted">
                  {selectedItem.tags.join(" ")}
                </p>
              )}
            </div>
          </div>
        )}
        </div>
      </main>

      {meetingDetail && (
        <aside className="flex w-80 shrink-0 flex-col border-l border-pds-border">
          <div className="border-b border-pds-border p-3">
            <h3 className="text-pds-sm font-medium uppercase tracking-wide text-pds-muted">
              Linked tasks
            </h3>
            <p className="mt-0.5 text-pds-caption text-pds-subtle">
              {linkedTasks.length} task{linkedTasks.length === 1 ? "" : "s"}
            </p>
          </div>
          <ul
            className={`min-h-0 overflow-auto p-2 ${
              selectedTaskId ? "max-h-[42%] shrink-0" : "flex-1"
            }`}
          >
            {linkedTasks.length === 0 && (
              <li className="px-2 py-4 text-pds-caption text-pds-muted">
                No linked tasks. Save with actions or add tasks later.
              </li>
            )}
            {linkedTasks.map((task) => {
              const status = getItemStatus(task);
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
                        <span className={statusBadge(status)}>{status}</span>
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
                      {status === "active" ? (
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
                      {status === "active" && (
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
