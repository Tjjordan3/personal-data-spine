import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  formatFocusSummary,
  loadFocusStream,
  type FocusEntry,
  type FocusUrgency,
} from "../lib/db/focus";
import { FocusTimerBar } from "./FocusTimerBar";
import { FocusTimerProvider } from "./FocusTimerContext";
import { FocusTimerShortcuts } from "./FocusTimerShortcuts";

interface FocusViewProps {
  onSelectItem: (id: string, kind: FocusEntry["kind"]) => void;
  onQuickCreate: (type: "task" | "subscription" | "project" | "note") => void;
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
  statsTick,
}: FocusViewProps & { statsTick: number }) {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-pds-border px-4 py-4">
        <h2 className="text-sm font-semibold text-pds-text">Today</h2>
        <p className="mt-1 text-xs text-pds-muted">{summaryLine}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && (
          <p className="px-4 py-8 text-center text-sm text-pds-muted">Loading…</p>
        )}
        {error && (
          <p className="mx-4 mt-4 rounded bg-red-950/40 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <p className="max-w-sm text-sm text-pds-muted">
              Nothing urgent right now. Capture a task, subscription, or project
              to see it here.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => onQuickCreate("task")}
                className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white"
              >
                New task
              </button>
              <button
                type="button"
                onClick={() => onQuickCreate("subscription")}
                className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-text"
              >
                New subscription
              </button>
              <button
                type="button"
                onClick={() => onQuickCreate("project")}
                className="rounded border border-emerald-800/60 px-3 py-1.5 text-xs text-emerald-300"
              >
                New project
              </button>
              <button
                type="button"
                onClick={() => void openCapture()}
                className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-text"
              >
                Quick capture
              </button>
            </div>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <ul className="divide-y divide-pds-border px-2 py-2">
            {entries.map((entry) => (
              <li key={`${entry.kind}-${entry.item.id}`}>
                <button
                  type="button"
                  onClick={() => onSelectItem(entry.item.id, entry.kind)}
                  className="flex w-full flex-col gap-1 rounded-lg px-3 py-3 text-left transition hover:bg-pds-panel"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${urgencyClass(entry.urgency)}`}
                    >
                      {urgencyLabel(entry.urgency)}
                    </span>
                    <span className="rounded bg-pds-chip px-1.5 py-0.5 text-[10px] text-pds-chip-fg">
                      {kindLabel(entry.kind)}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-pds-text">
                    {preview(entry.item.content)}
                  </span>
                  {(entry.kind === "subscription" ||
                    entry.kind === "project") &&
                    (entry.item.metadata.notes as string | undefined)?.trim() && (
                      <span className="text-[11px] leading-snug text-pds-subtle">
                        {preview(
                          (entry.item.metadata.notes as string).trim(),
                          120,
                        )}
                      </span>
                    )}
                  <span className="text-[11px] text-pds-muted">
                    {entry.detail}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FocusTimerBar />
    </div>
  );
}

export function FocusView(props: FocusViewProps) {
  const [statsTick, setStatsTick] = useState(0);

  return (
    <FocusTimerProvider onStatsChange={() => setStatsTick((t) => t + 1)}>
      <FocusTimerShortcuts />
      <FocusViewBody {...props} statsTick={statsTick} />
    </FocusTimerProvider>
  );
}
