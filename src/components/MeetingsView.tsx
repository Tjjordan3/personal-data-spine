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
import type { Item } from "../lib/db/types";
import { EmptyState } from "./EmptyState";
import { ItemEditForm } from "./ItemEditForm";
import { MeetingMode } from "./MeetingMode";
import { TaskFocusStartButton } from "./TaskFocusStartButton";

interface MeetingsViewProps {
  onToast: (message: string, kind: "success" | "error") => void;
  onNavigateToFocus?: () => void;
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
      return;
    }
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
    const unlisten = listen("item:saved", () => {
      void refresh();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refresh]);

  function handleSaved(meetingId: string) {
    setSelectedId(meetingId);
    setEditing(false);
    void refresh();
  }

  function startNewMeeting() {
    setSelectedId(null);
    setSelectedItem(null);
    setLinkedTasks([]);
    setEditing(false);
    setComposeKey((k) => k + 1);
  }

  async function handleTaskStatus(task: Item, status: ItemStatus) {
    setTaskBusyId(task.id);
    try {
      await setItemStatus(task.id, status);
      await emit("item:saved", {});
      if (selectedItem?.type === "meeting") {
        setLinkedTasks(await getTasksForMeeting(selectedItem.id));
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
          <h2 className="text-sm font-semibold text-pds-text">Meetings</h2>
          <p className="text-[10px] text-pds-muted">Saved notes and action items</p>
          <button
            type="button"
            onClick={startNewMeeting}
            className="mt-2 w-full rounded bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white"
          >
            New meeting
          </button>
        </div>
        <ul className="min-h-0 flex-1 overflow-auto p-2">
          {loading && (
            <li className="px-2 py-4 text-[11px] text-pds-muted">Loading…</li>
          )}
          {error && (
            <li className="rounded border border-red-900/50 bg-red-950/40 px-2 py-2 text-[11px] text-red-300">
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
                  className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  New meeting
                </button>
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
                    setSelectedId(item.id);
                  }}
                  className={`w-full rounded border px-2 py-2 text-left text-[11px] transition ${
                    selected
                      ? "border-violet-600 bg-violet-950/30 text-pds-text"
                      : "border-pds-border bg-pds-panel/50 text-pds-text hover:border-pds-muted"
                  }`}
                >
                  <p className="font-medium leading-snug">{meetingTitle(item)}</p>
                  {meetingBodyPreview(item, 60) && (
                    <p className="mt-0.5 text-[10px] text-pds-muted line-clamp-2">
                      {meetingBodyPreview(item, 60)}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-pds-subtle">
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
        {selectedId == null ? (
          <MeetingMode
            key={composeKey}
            onSaved={handleSaved}
            onError={(msg) => onToast(msg, "error")}
            onSuccess={(msg) => onToast(msg, "success")}
          />
        ) : !selectedItem ? (
          <p className="p-4 text-sm text-pds-muted">Loading…</p>
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
            <div className="border-b border-pds-border px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-pds-text">
                    {selectedItem.type === "meeting"
                      ? meetingTitle(selectedItem)
                      : "Linked task"}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-pds-muted">
                    {selectedItem.type}
                    {" · "}
                    {formatTime(selectedItem.created_at)}
                    {getItemStatus(selectedItem) !== "active" &&
                      ` · ${getItemStatus(selectedItem)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="shrink-0 rounded border border-pds-border px-3 py-1 text-xs text-pds-muted hover:bg-pds-chip"
                >
                  Edit
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {selectedItem.type === "meeting" ? (
                <>
                  {selectedItem.content ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-pds-text">
                      {selectedItem.content}
                    </pre>
                  ) : (
                    <p className="text-sm text-pds-muted">No notes.</p>
                  )}
                  {decisions.length > 0 && (
                    <div className="mt-4 rounded border border-pds-border bg-pds-panel/50 p-3">
                      <h3 className="text-[11px] font-medium uppercase text-pds-muted">
                        Decisions
                      </h3>
                      <ul className="mt-2 list-inside list-disc text-sm text-pds-text">
                        {decisions.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm leading-relaxed text-pds-text">
                  {selectedItem.content}
                </p>
              )}
              {selectedItem.tags.length > 0 && (
                <p className="mt-4 text-[11px] text-pds-muted">
                  {selectedItem.tags.join(" ")}
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {meetingDetail && (
        <aside className="flex w-52 shrink-0 flex-col border-l border-pds-border">
          <div className="border-b border-pds-border p-3">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-pds-muted">
              Linked tasks
            </h3>
            <p className="mt-0.5 text-[10px] text-pds-subtle">
              {linkedTasks.length} task{linkedTasks.length === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="min-h-0 flex-1 overflow-auto p-2">
            {linkedTasks.length === 0 && (
              <li className="px-2 py-4 text-[10px] text-pds-muted">
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
                    className={`rounded border px-2 py-2 text-[11px] ${
                      selectedId === task.id
                        ? "border-violet-600 bg-violet-950/30"
                        : "border-pds-border bg-pds-panel/50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(true);
                        setSelectedId(task.id);
                      }}
                      className="w-full text-left"
                    >
                      <p className="leading-snug text-pds-text">
                        {task.content.slice(0, 80)}
                        {task.content.length > 80 ? "…" : ""}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-1 text-[10px]">
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
                          className="rounded bg-emerald-800/50 px-2 py-0.5 text-[10px] text-emerald-200 disabled:opacity-40"
                        >
                          Done
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleTaskStatus(task, "active")}
                          className="rounded border border-pds-border px-2 py-0.5 text-[10px] text-pds-muted disabled:opacity-40"
                        >
                          Restore
                        </button>
                      )}
                      <TaskFocusStartButton
                        task={task}
                        onNavigateToFocus={onNavigateToFocus}
                        className="rounded bg-violet-600/80 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-violet-500"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>
      )}
    </div>
  );
}
