import type { Item } from "../lib/db/types";
import { useFocusTimer } from "./FocusTimerContext";

interface TaskFocusStartButtonProps {
  task: Item;
  onNavigateToFocus?: () => void;
  className?: string;
}

export function TaskFocusStartButton({
  task,
  onNavigateToFocus,
  className = "pds-btn-primary w-full py-2 text-xs",
}: TaskFocusStartButtonProps) {
  const timer = useFocusTimer();
  const isSameTaskActive =
    timer.taskId === task.id &&
    timer.kind === "focus" &&
    (timer.phase === "running" || timer.phase === "paused");

  async function handleClick() {
    if (isSameTaskActive) {
      onNavigateToFocus?.();
      return;
    }
    await timer.startForTask(task);
    onNavigateToFocus?.();
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className={className}
    >
      {isSameTaskActive ? "View focus timer" : "Start focus"}
    </button>
  );
}
