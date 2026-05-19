import { toDateKey } from "../lib/db/dates";
import {
  BREAK_PRESET_MINUTES,
  FOCUS_PRESET_MINUTES,
} from "../lib/focus/timer";
import type { Item } from "../lib/db/types";
import { useFocusTimer } from "./FocusTimerContext";

function taskDueLabel(task: Item): string {
  const due = task.metadata.due_date as string | undefined;
  if (!due) return "No due date";
  const key = toDateKey(due);
  return key ? `Due ${key}` : "Due date set";
}

export function FocusTimerBar() {
  const timer = useFocusTimer();
  const isBreak =
    timer.phase === "break" ||
    (timer.kind === "break" && timer.phase === "paused");
  const isActive =
    timer.phase === "running" ||
    timer.phase === "paused" ||
    timer.phase === "break";
  const canPickPresets = timer.phase === "idle" || timer.phase === "task_pick";

  return (
    <>
      <div className="sticky bottom-0 z-10 border-t border-pds-border bg-pds-panel/95 px-4 py-3 backdrop-blur-sm">
        <div
          key={isBreak ? "break" : "focus"}
          className="pds-timer-mode"
        >
        {isBreak ? (
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-pds-muted">
                Break
              </p>
              <p className="font-mono text-2xl font-semibold tabular-nums text-pds-text">
                {timer.displayLabel}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              {(timer.phase === "break" || timer.phase === "paused") && (
                <button
                  type="button"
                  onClick={() => timer.togglePause()}
                  className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-text"
                >
                  {timer.phase === "paused" ? "Resume" : "Pause"}
                </button>
              )}
              <button
                type="button"
                onClick={() => timer.endBreak()}
                className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white"
              >
                End break
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-pds-muted">
                  {isActive ? "Focusing" : "Pomodoro"}
                </p>
                {timer.taskId ? (
                  <p className="truncate text-sm font-medium text-pds-text">
                    {timer.taskLabel}
                  </p>
                ) : (
                  <p className="text-sm text-pds-muted">Pick a task to start</p>
                )}
                {isActive && (
                  <p className="font-mono text-2xl font-semibold tabular-nums text-violet-600 dark:text-violet-300">
                    {timer.displayLabel}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {canPickPresets && (
                  <>
                    <button
                      type="button"
                      title="25 min focus (1)"
                      onClick={() =>
                        timer.setPresetMinutes(FOCUS_PRESET_MINUTES, "focus")
                      }
                      className={`rounded px-2 py-1 text-[11px] ${
                        timer.plannedMinutes === FOCUS_PRESET_MINUTES &&
                        timer.kind === "focus"
                          ? "bg-violet-600 text-white"
                          : "bg-pds-chip text-pds-chip-fg"
                      }`}
                    >
                      25
                    </button>
                    <button
                      type="button"
                      title="5 min break (2)"
                      onClick={() =>
                        timer.setPresetMinutes(BREAK_PRESET_MINUTES, "break")
                      }
                      className={`rounded px-2 py-1 text-[11px] ${
                        timer.plannedMinutes === BREAK_PRESET_MINUTES &&
                        timer.kind === "break"
                          ? "bg-emerald-600 text-white"
                          : "bg-pds-chip text-pds-chip-fg"
                      }`}
                    >
                      5
                    </button>
                  </>
                )}
                {!isActive && (
                  <>
                    <button
                      type="button"
                      onClick={() => timer.openTaskPicker()}
                      className="rounded border border-pds-border px-2.5 py-1 text-[11px] text-pds-text"
                    >
                      {timer.taskId ? "Change task" : "Pick task"}
                    </button>
                    {timer.hasLastTask && (
                      <button
                        type="button"
                        onClick={() => void timer.resumeLastTask()}
                        className="rounded border border-violet-800/50 px-2.5 py-1 text-[11px] text-violet-700 dark:text-violet-300"
                      >
                        Resume last
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!timer.taskId && timer.kind === "focus"}
                      onClick={() => {
                        if (timer.kind === "break") timer.startBreak();
                        else void timer.startWithCurrentTask();
                      }}
                      className="rounded bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                    >
                      {timer.kind === "break" ? "Start break" : "Start"}
                    </button>
                  </>
                )}
                {isActive && timer.kind === "focus" && (
                  <>
                    <button
                      type="button"
                      onClick={() => timer.togglePause()}
                      className="rounded border border-pds-border px-2.5 py-1 text-[11px] text-pds-text"
                    >
                      {timer.phase === "paused" ? "Resume" : "Pause"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void timer.stopSession()}
                      className="rounded border border-red-900/40 px-2.5 py-1 text-[11px] text-red-600 dark:text-red-300"
                    >
                      Stop
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-[10px] text-pds-subtle">
              Shortcuts: <kbd className="rounded bg-pds-chip px-1">p</kbd> pause ·{" "}
              <kbd className="rounded bg-pds-chip px-1">Shift+P</kbd> stop ·{" "}
              <kbd className="rounded bg-pds-chip px-1">1</kbd> 25m ·{" "}
              <kbd className="rounded bg-pds-chip px-1">2</kbd> 5m break
            </p>
          </div>
        )}
        </div>
      </div>

      {timer.showTaskPicker && (
        <div
          className="pds-modal-backdrop fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Pick a task"
        >
          <div className="pds-modal-panel flex max-h-[70vh] w-full max-w-md flex-col rounded-lg border border-pds-border bg-pds-panel shadow-xl">
            <div className="flex items-center justify-between border-b border-pds-border px-4 py-3">
              <h3 className="text-sm font-semibold text-pds-text">Pick a task</h3>
              <button
                type="button"
                onClick={() => timer.closeTaskPicker()}
                className="text-xs text-pds-muted hover:text-pds-text"
              >
                Cancel
              </button>
            </div>
            <ul className="min-h-0 flex-1 overflow-auto divide-y divide-pds-border">
              {timer.loadingTasks && (
                <li className="px-4 py-6 text-center text-sm text-pds-muted">
                  Loading tasks…
                </li>
              )}
              {!timer.loadingTasks && timer.activeTasks.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-pds-muted">
                  No active tasks. Create one from the empty state above.
                </li>
              )}
              {timer.activeTasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => timer.confirmTask(task)}
                    className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-pds-panel-2"
                  >
                    <span className="text-sm font-medium text-pds-text">
                      {task.content.replace(/\s+/g, " ").trim().slice(0, 80)}
                    </span>
                    <span className="text-[11px] text-pds-muted">
                      {taskDueLabel(task)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {timer.taskId && (
              <div className="border-t border-pds-border px-4 py-3">
                <button
                  type="button"
                  onClick={() => void timer.startWithCurrentTask()}
                  className="w-full rounded bg-violet-600 py-2 text-xs font-medium text-white"
                >
                  Start {timer.plannedMinutes} min on selected task
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
