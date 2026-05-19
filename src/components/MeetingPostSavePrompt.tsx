import { useEffect, useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { todayKey } from "../lib/db/dates";
import { getItemStatus } from "../lib/db/itemStatus";
import { updateItem } from "../lib/db/items";
import type { Item } from "../lib/db/types";
import {
  buildMeetingSaveLinkSuggestions,
  type LinkSuggestion,
} from "../lib/links/suggestions";
import { useFocusTimer } from "./FocusTimerContext";

interface MeetingPostSavePromptProps {
  meeting: Item;
  tasks: Item[];
  onDismiss: () => void;
  onToast: (message: string, kind: "success" | "error") => void;
  onNavigateToFocus?: () => void;
  onTasksChanged?: () => void;
}

export function MeetingPostSavePrompt({
  meeting,
  tasks,
  onDismiss,
  onToast,
  onNavigateToFocus,
  onTasksChanged,
}: MeetingPostSavePromptProps) {
  const timer = useFocusTimer();
  const [busy, setBusy] = useState(false);
  const [linkSuggestions, setLinkSuggestions] = useState<LinkSuggestion[]>([]);
  const dismissedKeys = useRef(new Set<string>());

  const openTasks = tasks.filter((t) => getItemStatus(t) === "active");
  const visibleSuggestions = linkSuggestions.filter(
    (s) => !dismissedKeys.current.has(s.key),
  );

  useEffect(() => {
    let cancelled = false;
    void buildMeetingSaveLinkSuggestions(meeting, tasks).then((list) => {
      if (!cancelled) setLinkSuggestions(list);
    });
    return () => {
      cancelled = true;
    };
  }, [meeting, tasks]);

  async function handleStartFocus() {
    const first = openTasks[0];
    if (!first) return;
    setBusy(true);
    try {
      await timer.startForTask(first);
      onNavigateToFocus?.();
      onDismiss();
      onToast("Focus timer started.", "success");
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Could not start focus",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAddAllToToday() {
    const today = todayKey();
    setBusy(true);
    try {
      for (const task of openTasks) {
        await updateItem(task.id, { metadata: { due_date: today } });
      }
      await emit("item:saved", {});
      onTasksChanged?.();
      onDismiss();
      onToast(
        `Set due today for ${openTasks.length} task${openTasks.length === 1 ? "" : "s"}.`,
        "success",
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Could not update due dates",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptLink(suggestion: LinkSuggestion) {
    setBusy(true);
    try {
      await suggestion.apply();
      await emit("item:saved", {});
      dismissedKeys.current.add(suggestion.key);
      setLinkSuggestions((prev) => prev.filter((s) => s.key !== suggestion.key));
      onTasksChanged?.();
      onToast("Links created.", "success");
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Could not create links",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleDismissLink(suggestion: LinkSuggestion) {
    dismissedKeys.current.add(suggestion.key);
    setLinkSuggestions((prev) => prev.filter((s) => s.key !== suggestion.key));
  }

  if (openTasks.length === 0 && visibleSuggestions.length === 0) {
    return null;
  }

  return (
    <div
      className="border-t border-pds-border bg-pds-panel-2 px-4 py-3"
      role="region"
      aria-label="After save actions"
    >
      {openTasks.length > 0 && (
        <>
          <p className="text-pds-sm text-pds-text">
            Meeting saved with {openTasks.length} open task
            {openTasks.length === 1 ? "" : "s"}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleStartFocus()}
              className="pds-btn-primary px-3 py-1.5 text-pds-caption disabled:opacity-40"
            >
              Start focus on first action
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAddAllToToday()}
              className="rounded border border-pds-border px-3 py-1.5 text-pds-caption text-pds-muted hover:bg-pds-chip disabled:opacity-40"
            >
              Set open tasks due today
            </button>
          </div>
        </>
      )}

      {visibleSuggestions.length > 0 && (
        <div className={openTasks.length > 0 ? "mt-3 space-y-2" : "space-y-2"}>
          {visibleSuggestions.map((suggestion) => (
            <div
              key={suggestion.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-pds-border bg-pds-panel px-3 py-2"
            >
              <p className="min-w-0 flex-1 text-pds-sm text-pds-text">
                {suggestion.message}
              </p>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleAcceptLink(suggestion)}
                  className="pds-btn-primary px-2.5 py-1 text-pds-caption disabled:opacity-40"
                >
                  Link
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDismissLink(suggestion)}
                  className="rounded px-2.5 py-1 text-pds-caption text-pds-subtle hover:text-pds-muted"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2">
        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          className="rounded px-3 py-1.5 text-pds-caption text-pds-subtle hover:text-pds-muted"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

