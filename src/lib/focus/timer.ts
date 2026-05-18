export const FOCUS_PRESET_MINUTES = 25;
export const BREAK_PRESET_MINUTES = 5;
export const STORAGE_KEY = "pds-focus-timer";
export const LAST_TASK_KEY = "pds-focus-last-task";

export type TimerPhase =
  | "idle"
  | "task_pick"
  | "running"
  | "paused"
  | "break";

export interface PersistedTimerState {
  phase: TimerPhase;
  taskId: string | null;
  taskLabel: string;
  plannedMinutes: number;
  kind: "focus" | "break";
  startedAt: string;
  endsAt: string;
  pausedRemainingSeconds: number | null;
  workBlockId: string | null;
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function remainingSeconds(
  endsAt: string,
  nowMs: number = Date.now(),
): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - nowMs) / 1000));
}

export function endsAtFromNow(plannedMinutes: number, fromMs = Date.now()): string {
  return new Date(fromMs + plannedMinutes * 60_000).toISOString();
}

export function loadPersistedTimer(): PersistedTimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedTimerState;
  } catch {
    return null;
  }
}

export function savePersistedTimer(state: PersistedTimerState | null): void {
  if (!state) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadLastTaskId(): string | null {
  return localStorage.getItem(LAST_TASK_KEY);
}

export function saveLastTaskId(taskId: string): void {
  localStorage.setItem(LAST_TASK_KEY, taskId);
}

export function normalizePhaseOnLoad(
  state: PersistedTimerState,
): PersistedTimerState {
  if (state.phase === "paused" || state.phase === "running") {
    if (state.pausedRemainingSeconds != null) {
      return { ...state, phase: "paused" };
    }
    const left = remainingSeconds(state.endsAt);
    if (left <= 0) {
      return { ...state, phase: "running", pausedRemainingSeconds: 0 };
    }
    return state;
  }
  return state;
}
