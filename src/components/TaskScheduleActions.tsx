import { useState, type MouseEvent } from "react";
import { emit } from "@tauri-apps/api/event";
import { addDaysToKey, todayKey, toDateKey } from "../lib/db/dates";
import { updateItem } from "../lib/db/items";
import type { Item } from "../lib/db/types";

export const TASK_SCHEDULE_BTN =
  "rounded border border-pds-border px-2 py-0.5 text-pds-caption text-pds-muted hover:bg-pds-chip hover:text-pds-text disabled:opacity-40";

export const FOCUS_SCHEDULE_BTN =
  "rounded border border-pds-border px-1.5 py-0.5 text-[10px] text-pds-muted hover:bg-pds-panel-2 hover:text-pds-text disabled:opacity-40";

interface TaskScheduleActionsProps {
  task: Item;
  onChanged: () => void;
  onToast?: (message: string, kind: "success" | "error") => void;
  buttonClassName?: string;
}

export function TaskScheduleActions({
  task,
  onChanged,
  onToast,
  buttonClassName = TASK_SCHEDULE_BTN,
}: TaskScheduleActionsProps) {
  const [menu, setMenu] = useState<"snooze" | "reschedule" | null>(null);
  const [busy, setBusy] = useState(false);

  async function notifySaved() {
    await emit("item:saved", {});
    onChanged();
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

  const menuPanelClass =
    "mt-1 flex w-full flex-wrap items-center gap-1 border-t border-pds-border pt-1";

  return (
    <div onClick={(e: MouseEvent) => e.stopPropagation()}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setMenu(menu === "snooze" ? null : "snooze")}
        className={buttonClassName}
      >
        Snooze
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setMenu(menu === "reschedule" ? null : "reschedule")}
        className={buttonClassName}
      >
        Reschedule
      </button>

      {menu === "snooze" && (
        <div className={menuPanelClass}>
          <button
            type="button"
            className={buttonClassName}
            onClick={() => void snoozeUntil(addDaysToKey(today, 1))}
          >
            +1 day
          </button>
          <button
            type="button"
            className={buttonClassName}
            onClick={() => void snoozeUntil(addDaysToKey(today, 3))}
          >
            +3 days
          </button>
          <input
            type="date"
            className="rounded border border-pds-border bg-pds-input px-1 py-0.5 text-pds-caption text-pds-text"
            onChange={(e) => {
              if (e.target.value) void snoozeUntil(e.target.value);
            }}
          />
        </div>
      )}

      {menu === "reschedule" && (
        <div className={menuPanelClass}>
          <button
            type="button"
            className={buttonClassName}
            onClick={() => void rescheduleDue(addDaysToKey(dueKey, 1))}
          >
            +1 day
          </button>
          <button
            type="button"
            className={buttonClassName}
            onClick={() => void rescheduleDue(addDaysToKey(dueKey, 7))}
          >
            +1 week
          </button>
          <input
            type="date"
            className="rounded border border-pds-border bg-pds-input px-1 py-0.5 text-pds-caption text-pds-text"
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
