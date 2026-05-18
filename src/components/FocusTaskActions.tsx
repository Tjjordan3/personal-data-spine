import { useState, type MouseEvent } from "react";
import { emit } from "@tauri-apps/api/event";
import { addDaysToKey, todayKey, toDateKey } from "../lib/db/dates";
import { setItemStatus, updateItem } from "../lib/db/items";
import type { Item } from "../lib/db/types";
import { useFocusTimer } from "./FocusTimerContext";

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
  const [menu, setMenu] = useState<"snooze" | "reschedule" | null>(null);
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

  async function snoozeUntil(dateKey: string) {
    setBusy(true);
    setMenu(null);
    try {
      await updateItem(task.id, { metadata: { snoozed_until: dateKey } });
      await notifySaved();
      onToast?.(`Snoozed until ${dateKey}`, "success");
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : "Could not snooze",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function rescheduleDue(dateKey: string | null) {
    setBusy(true);
    setMenu(null);
    try {
      await updateItem(task.id, { metadata: { due_date: dateKey } });
      await notifySaved();
      onToast?.(
        dateKey ? `Due date set to ${dateKey}` : "Due date cleared",
        "success",
      );
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : "Could not reschedule",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  const today = todayKey();
  const due = (task.metadata.due_date as string | undefined) ?? "";
  const dueKey = due ? toDateKey(due) : today;

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
          className={`${btn} border-violet-700/50 text-violet-700 dark:text-violet-300`}
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
        <button
          type="button"
          disabled={busy}
          onClick={() => setMenu(menu === "snooze" ? null : "snooze")}
          className={btn}
        >
          Snooze
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setMenu(menu === "reschedule" ? null : "reschedule")}
          className={btn}
        >
          Reschedule
        </button>
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

      {menu === "snooze" && (
        <div className="flex flex-wrap items-center gap-1 border-t border-pds-border pt-1">
          <button
            type="button"
            className={btn}
            onClick={() => void snoozeUntil(addDaysToKey(today, 1))}
          >
            +1 day
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => void snoozeUntil(addDaysToKey(today, 3))}
          >
            +3 days
          </button>
          <input
            type="date"
            className="rounded border border-pds-border bg-pds-input px-1 py-0.5 text-[10px] text-pds-text"
            onChange={(e) => {
              if (e.target.value) void snoozeUntil(e.target.value);
            }}
          />
        </div>
      )}

      {menu === "reschedule" && (
        <div className="flex flex-wrap items-center gap-1 border-t border-pds-border pt-1">
          <button
            type="button"
            className={btn}
            onClick={() => void rescheduleDue(addDaysToKey(dueKey, 1))}
          >
            +1 day
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => void rescheduleDue(addDaysToKey(dueKey, 7))}
          >
            +1 week
          </button>
          <input
            type="date"
            className="rounded border border-pds-border bg-pds-input px-1 py-0.5 text-[10px] text-pds-text"
            defaultValue={dueKey}
            onChange={(e) => {
              if (e.target.value) void rescheduleDue(e.target.value);
            }}
          />
        </div>
      )}
    </div>
  );
}
