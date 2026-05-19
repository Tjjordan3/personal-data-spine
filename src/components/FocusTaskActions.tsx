import { useState, type MouseEvent } from "react";
import { emit } from "@tauri-apps/api/event";
import { setItemStatus, updateItem } from "../lib/db/items";
import type { Item } from "../lib/db/types";
import { useFocusTimer } from "./FocusTimerContext";
import {
  FOCUS_SCHEDULE_BTN,
  TaskScheduleActions,
} from "./TaskScheduleActions";

interface FocusTaskActionsProps {
  task: Item;
  onChanged: () => void;
  onToast?: (message: string, kind: "success" | "error") => void;
}

const btn =
  "rounded border border-pds-border px-1.5 py-0.5 text-[10px] text-pds-muted hover:bg-pds-panel-2 hover:text-pds-text";

export function FocusTaskActions({
  task,
  onChanged,
  onToast,
}: FocusTaskActionsProps) {
  const timer = useFocusTimer();
  const [busy, setBusy] = useState(false);

  async function notifySaved() {
    await emit("item:saved", {});
    onChanged();
  }

  async function handleStart() {
    try {
      await timer.startForTask(task);
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : "Could not start focus",
        "error",
      );
    }
  }

  async function handleDone() {
    setBusy(true);
    try {
      await setItemStatus(task.id, "done");
      await notifySaved();
      onToast?.("Task marked done.", "success");
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : "Could not mark done",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLogOutcome() {
    const note = window.prompt("Log outcome (one line):", "");
    if (note === null) return;
    setBusy(true);
    try {
      await updateItem(task.id, {
        metadata: {
          outcome: note.trim() || null,
        },
      });
      await setItemStatus(task.id, "done");
      await notifySaved();
      onToast?.("Outcome saved.", "success");
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : "Could not save outcome",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-1"
      onClick={(e: MouseEvent) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleStart()}
          className={`${btn} border-emerald-700/50 text-emerald-700 dark:text-emerald-300`}
        >
          Start
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleDone()}
          className={btn}
        >
          Done
        </button>
        <TaskScheduleActions
          task={task}
          onChanged={onChanged}
          onToast={onToast}
          buttonClassName={FOCUS_SCHEDULE_BTN}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleLogOutcome()}
          className={btn}
          title="Mark done and save a one-line outcome"
        >
          Log outcome
        </button>
      </div>
    </div>
  );
}
