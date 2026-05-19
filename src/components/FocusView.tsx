import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  formatFocusSummary,
  loadFocusStream,
  pickNextFocusTask,
  type FocusEntry,
  type FocusUrgency,
} from "../lib/db/focus";
import { FocusTimerBar } from "./FocusTimerBar";
import { FocusTimerShortcuts } from "./FocusTimerShortcuts";
import { FocusTaskActions } from "./FocusTaskActions";
import { EmptyState } from "./EmptyState";
import { useFocusTimer } from "./FocusTimerContext";

interface FocusViewProps {
  onSelectItem: (id: string, kind: FocusEntry["kind"]) => void;
  onQuickCreate: (type: "task" | "subscription" | "project" | "note") => void;
  onToast?: (message: string, kind: "success" | "error") => void;
}

function urgencyLabel(urgency: FocusUrgency): string {
  switch (urgency) {
    case "overdue":
      return "Overdue";
    case "today":
      return "Today";
    case "soon":
      return "Soon";
    case "active":
      return "Active";
    default:
      return "";
  }
}

function urgencyClass(urgency: FocusUrgency): string {
  switch (urgency) {
    case "overdue":
      return "bg-red-600/20 text-red-400 dark:text-red-300";
    case "today":
      return "bg-amber-600/20 text-amber-700 dark:text-amber-300";
    case "soon":
      return "bg-amber-600/10 text-amber-800 dark:text-amber-200";
    case "active":
      return "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300";
    default:
      return "bg-pds-chip text-pds-chip-fg";
  }
}

function kindLabel(kind: FocusEntry["kind"]): string {
  if (kind === "subscription") return "Subscription";
  if (kind === "project") return "Project";
  return "Task";
}

function preview(content: string, max = 120): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

function FocusViewBody({
  onSelectItem,
  onQuickCreate,
  onToast,
  statsTick,
}: FocusViewProps & { statsTick: number }) {
  const timer = useFocusTimer();
  const [entries, setEntries] = useState<FocusEntry[]>([]);
  const [summaryLine, setSummaryLine] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { entries: data, summary } = await loadFocusStream();
      setEntries(data);
      setSummaryLine(formatFocusSummary(summary));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load focus");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, statsTick]);

  useEffect(() => {
    const unlisten = listen("item:saved", () => {
      void refresh();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refresh]);

  async function openCapture() {
    try {
      await invoke("show_capture");
    } catch {
      onQuickCreate("note");
    }
  }

  async function handleStartNext() {
    const next = pickNextFocusTask(entries);
    if (!next) {
      onToast?.("No tasks in focus stream.", "error");
      return;
    }
    try {
      await timer.startForTask(next.item);
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : "Could not start focus",
        "error",
      );
    }
  }

  const hasNextTask = pickNextFocusTask(entries) != null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-pds-border px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-pds-base font-semibold text-pds-text">Today</h2>
            <p className="mt-1 text-pds-sm text-pds-muted">{summaryLine}</p>
          </div>
          {hasNextTask && (
            <button
              type="button"
              onClick={() => void handleStartNext()}
              className="pds-btn-primary shrink-0 px-3 py-1.5 text-pds-sm"
            >
              Start focus
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && (
          <p className="px-4 py-8 text-center text-pds-base text-pds-muted">Loading…</p>
        )}
        {error && (
          <p className="mx-4 mt-4 rounded bg-red-950/40 px-3 py-2 text-pds-sm text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && entries.length === 0 && (
          <EmptyState
            title="All clear for now"
            description="Nothing urgent in your focus stream. Capture a task or start a timer when you're ready."
          >
            <>
              <button
                type="button"
                onClick={() => onQuickCreate("task")}
                className="pds-btn-primary px-3 py-1.5 text-pds-sm"
              >
                New task
              </button>
              <button
                type="button"
                onClick={() => onQuickCreate("subscription")}
                className="rounded border border-pds-border px-3 py-1.5 text-pds-sm text-pds-text"
              >
                New subscription
              </button>
              <button
                type="button"
                onClick={() => onQuickCreate("project")}
                className="rounded border border-emerald-800/60 px-3 py-1.5 text-pds-sm text-emerald-300"
              >
                New project
              </button>
              <button
                type="button"
                onClick={() => void openCapture()}
                className="rounded border border-pds-border px-3 py-1.5 text-pds-sm text-pds-text"
              >
                Quick capture
              </button>
            </>
          </EmptyState>
        )}

        {!loading && entries.length > 0 && (
          <ul className="divide-y divide-pds-border px-2 py-2">
            {entries.map((entry) => (
              <li key={`${entry.kind}-${entry.item.id}`}>
                <div className="flex w-full flex-col gap-1 rounded-lg px-3 py-3 transition hover:bg-pds-panel">
                  <button
                    type="button"
                    onClick={() => onSelectItem(entry.item.id, entry.kind)}
                    className="flex w-full flex-col gap-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-pds-caption font-medium uppercase tracking-wide ${urgencyClass(entry.urgency)}`}
                      >
                        {urgencyLabel(entry.urgency)}
                      </span>
                      <span className="rounded bg-pds-chip px-1.5 py-0.5 text-pds-caption text-pds-chip-fg">
                        {kindLabel(entry.kind)}
                      </span>
                    </div>
                    <span className="text-pds-base font-medium text-pds-text">
                      {preview(entry.item.content)}
                    </span>
                    {(entry.kind === "subscription" ||
                      entry.kind === "project") &&
                      (entry.item.metadata.notes as string | undefined)?.trim() && (
                        <span className="text-pds-sm leading-snug text-pds-subtle">
                          {preview(
                            (entry.item.metadata.notes as string).trim(),
                            120,
                          )}
                        </span>
                      )}
                    <span className="text-pds-sm text-pds-muted">
                      {entry.detail}
                    </span>
                  </button>
                  {entry.kind === "task" && (
                    <FocusTaskActions
                      task={entry.item}
                      onChanged={() => void refresh()}
                      onToast={onToast}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FocusTimerBar />
    </div>
  );
}

export function FocusView({
  statsTick,
  ...props
}: FocusViewProps & { statsTick: number }) {
  return (
    <>
      <FocusTimerShortcuts />
      <FocusViewBody {...props} statsTick={statsTick} />
    </>
  );
}
