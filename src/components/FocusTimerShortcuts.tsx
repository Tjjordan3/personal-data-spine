import { useEffect } from "react";
import {
  BREAK_PRESET_MINUTES,
  FOCUS_PRESET_MINUTES,
} from "../lib/focus/timer";
import { useFocusTimer } from "./FocusTimerContext";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function FocusTimerShortcuts() {
  const timer = useFocusTimer();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (event.key === "p" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        if (timer.phase === "idle" || timer.phase === "task_pick") {
          if (timer.kind === "break") timer.startBreak();
          else void timer.startWithCurrentTask();
        } else if (
          timer.phase === "running" ||
          timer.phase === "paused" ||
          timer.phase === "break"
        ) {
          timer.togglePause();
        }
        return;
      }

      if (event.key === "P" && event.shiftKey) {
        event.preventDefault();
        if (timer.phase === "break" || (timer.kind === "break" && timer.phase === "paused")) {
          timer.endBreak();
        } else {
          void timer.stopSession();
        }
        return;
      }

      if (timer.phase !== "idle" && timer.phase !== "task_pick") return;

      if (event.key === "1") {
        event.preventDefault();
        timer.setPresetMinutes(FOCUS_PRESET_MINUTES, "focus");
      }
      if (event.key === "2") {
        event.preventDefault();
        timer.setPresetMinutes(BREAK_PRESET_MINUTES, "break");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [timer]);

  return null;
}
