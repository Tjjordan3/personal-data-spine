import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { emit } from "@tauri-apps/api/event";
import { listItems } from "../lib/db/items";
import { finishWorkBlock, startWorkBlock } from "../lib/db/workBlocks";
import type { Item } from "../lib/db/types";
import {
  BREAK_PRESET_MINUTES,
  FOCUS_PRESET_MINUTES,
  endsAtFromNow,
  formatCountdown,
  loadLastTaskId,
  loadPersistedTimer,
  normalizePhaseOnLoad,
  remainingSeconds,
  saveLastTaskId,
  savePersistedTimer,
  type PersistedTimerState,
  type TimerPhase,
} from "../lib/focus/timer";
import { playTimerChime, unlockTimerAudio } from "../lib/focus/chime";

export interface FocusTimerContextValue {
  phase: TimerPhase;
  taskId: string | null;
  taskLabel: string;
  plannedMinutes: number;
  kind: "focus" | "break";
  displaySeconds: number;
  displayLabel: string;
  showTaskPicker: boolean;
  activeTasks: Item[];
  loadingTasks: boolean;
  openTaskPicker: () => void;
  closeTaskPicker: () => void;
  confirmTask: (task: Item) => void;
  setPresetMinutes: (minutes: number, kind?: "focus" | "break") => void;
  startWithCurrentTask: () => Promise<void>;
  startBreak: () => void;
  togglePause: () => void;
  stopSession: () => Promise<void>;
  endBreak: () => void;
  resumeLastTask: () => Promise<void>;
  hasLastTask: boolean;
  refreshStats: () => void;
}

const FocusTimerContext = createContext<FocusTimerContextValue | null>(null);

function taskPreview(content: string, max = 60): string {
  const one = content.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max)}…` : one;
}

function sortTasksForPicker(tasks: Item[]): Item[] {
  return [...tasks].sort((a, b) => {
    const dueA = (a.metadata.due_date as string | undefined) ?? "";
    const dueB = (b.metadata.due_date as string | undefined) ?? "";
    if (dueA && dueB) return dueA.localeCompare(dueB);
    if (dueA) return -1;
    if (dueB) return 1;
    return b.created_at.localeCompare(a.created_at);
  });
}

export function FocusTimerProvider({
  children,
  onStatsChange,
}: {
  children: ReactNode;
  onStatsChange?: () => void;
}) {
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskLabel, setTaskLabel] = useState("");
  const [plannedMinutes, setPlannedMinutes] = useState(FOCUS_PRESET_MINUTES);
  const [kind, setKind] = useState<"focus" | "break">("focus");
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [pausedRemaining, setPausedRemaining] = useState<number | null>(null);
  const [workBlockId, setWorkBlockId] = useState<string | null>(null);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [activeTasks, setActiveTasks] = useState<Item[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tick, setTick] = useState(0);
  const completingRef = useRef(false);
  const expiryHandledRef = useRef(false);
  const [hasLastTask, setHasLastTask] = useState(() => Boolean(loadLastTaskId()));

  const persist = useCallback(
    (next: Partial<PersistedTimerState> & { phase: TimerPhase }) => {
      if (next.phase === "idle") {
        savePersistedTimer(null);
        return;
      }
      const state: PersistedTimerState = {
        phase: next.phase,
        taskId: next.taskId ?? taskId,
        taskLabel: next.taskLabel ?? taskLabel,
        plannedMinutes: next.plannedMinutes ?? plannedMinutes,
        kind: next.kind ?? kind,
        startedAt: next.startedAt ?? new Date().toISOString(),
        endsAt: next.endsAt ?? endsAt ?? endsAtFromNow(plannedMinutes),
        pausedRemainingSeconds:
          next.pausedRemainingSeconds !== undefined
            ? next.pausedRemainingSeconds
            : pausedRemaining,
        workBlockId: next.workBlockId ?? workBlockId,
      };
      savePersistedTimer(state);
    },
    [taskId, taskLabel, plannedMinutes, kind, endsAt, pausedRemaining, workBlockId],
  );

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const tasks = await listItems({ type: "task", status: "active", limit: 300 });
      setActiveTasks(sortTasksForPicker(tasks));
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  const completeSession = useCallback(
    async (status: "completed" | "abandoned") => {
      if (completingRef.current) return;
      completingRef.current = true;
      try {
        if (workBlockId && kind === "focus") {
          await finishWorkBlock(workBlockId, status);
          if (taskId && status === "completed") {
            saveLastTaskId(taskId);
            setHasLastTask(true);
          }
          await emit("item:saved", {});
          onStatsChange?.();
        }
      } finally {
        completingRef.current = false;
        setPhase("idle");
        setEndsAt(null);
        setPausedRemaining(null);
        setWorkBlockId(null);
        setTaskId(null);
        setTaskLabel("");
        setKind("focus");
        setShowTaskPicker(false);
        savePersistedTimer(null);
      }
    },
    [workBlockId, kind, taskId, onStatsChange],
  );

  const beginFocusSession = useCallback(
    async (id: string, label: string, minutes: number) => {
      const block = await startWorkBlock({
        taskId: id,
        taskLabel: label,
        plannedMinutes: minutes,
        kind: "focus",
      });
      const end = endsAtFromNow(minutes);
      setTaskId(id);
      setTaskLabel(label);
      setPlannedMinutes(minutes);
      setKind("focus");
      setWorkBlockId(block.id);
      setEndsAt(end);
      setPausedRemaining(null);
      expiryHandledRef.current = false;
      setPhase("running");
      setShowTaskPicker(false);
      unlockTimerAudio();
      persist({
        phase: "running",
        taskId: id,
        taskLabel: label,
        plannedMinutes: minutes,
        kind: "focus",
        startedAt: new Date().toISOString(),
        endsAt: end,
        pausedRemainingSeconds: null,
        workBlockId: block.id,
      });
    },
    [persist],
  );

  const beginBreak = useCallback((minutes: number = BREAK_PRESET_MINUTES) => {
      const end = endsAtFromNow(minutes);
      setTaskId(null);
      setTaskLabel("Break");
      setPlannedMinutes(minutes);
      setKind("break");
      setWorkBlockId(null);
      setEndsAt(end);
      setPausedRemaining(null);
      expiryHandledRef.current = false;
      setPhase("break");
      unlockTimerAudio();
      persist({
        phase: "break",
        taskId: null,
        taskLabel: "Break",
        plannedMinutes: minutes,
        kind: "break",
        startedAt: new Date().toISOString(),
        endsAt: end,
        pausedRemainingSeconds: null,
        workBlockId: null,
      });
    },
    [persist],
  );

  useEffect(() => {
    const saved = loadPersistedTimer();
    if (!saved) return;
    const state = normalizePhaseOnLoad(saved);
    setPhase(state.phase);
    setTaskId(state.taskId);
    setTaskLabel(state.taskLabel);
    setPlannedMinutes(state.plannedMinutes);
    setKind(state.kind);
    setEndsAt(state.endsAt);
    setPausedRemaining(state.pausedRemainingSeconds);
    setWorkBlockId(state.workBlockId);
    if (state.phase === "task_pick") setShowTaskPicker(true);
  }, []);

  useEffect(() => {
    if (phase !== "running" && phase !== "break" && phase !== "paused") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "running" && phase !== "break") return;
    if (!endsAt || pausedRemaining != null) return;
    const left = remainingSeconds(endsAt);
    if (left <= 0) {
      if (expiryHandledRef.current) return;
      expiryHandledRef.current = true;
      if (kind === "focus") {
        playTimerChime("focus_complete");
        void completeSession("completed").then(() =>
          beginBreak(BREAK_PRESET_MINUTES),
        );
      } else {
        playTimerChime("break_complete");
        setPhase("idle");
        setEndsAt(null);
        savePersistedTimer(null);
      }
    }
  }, [tick, phase, endsAt, pausedRemaining, kind, completeSession, beginBreak]);

  const displaySeconds = useMemo(() => {
    if (pausedRemaining != null) return pausedRemaining;
    if (!endsAt) return plannedMinutes * 60;
    return remainingSeconds(endsAt);
  }, [pausedRemaining, endsAt, plannedMinutes, tick]);

  const displayLabel = formatCountdown(displaySeconds);

  const openTaskPicker = useCallback(() => {
    void loadTasks();
    setShowTaskPicker(true);
    setPhase("task_pick");
    persist({
      phase: "task_pick",
      taskId,
      taskLabel,
      plannedMinutes,
      kind: "focus",
      startedAt: new Date().toISOString(),
      endsAt: endsAt ?? endsAtFromNow(plannedMinutes),
      pausedRemainingSeconds: pausedRemaining,
      workBlockId,
    });
  }, [
    loadTasks,
    persist,
    taskId,
    taskLabel,
    plannedMinutes,
    endsAt,
    pausedRemaining,
    workBlockId,
  ]);

  const closeTaskPicker = useCallback(() => {
    setShowTaskPicker(false);
    if (phase === "task_pick") {
      setPhase("idle");
      savePersistedTimer(null);
    }
  }, [phase]);

  const confirmTask = useCallback((task: Item) => {
    setTaskId(task.id);
    setTaskLabel(taskPreview(task.content));
    setShowTaskPicker(false);
    setPhase("idle");
    savePersistedTimer(null);
  }, []);

  const setPresetMinutes = useCallback(
    (minutes: number, presetKind: "focus" | "break" = "focus") => {
      setPlannedMinutes(minutes);
      setKind(presetKind);
      if (presetKind === "break" && phase === "idle") {
        setTaskLabel("Break");
      }
    },
    [phase],
  );

  const startWithCurrentTask = useCallback(async () => {
    if (!taskId || kind !== "focus") {
      openTaskPicker();
      return;
    }
    await beginFocusSession(taskId, taskLabel, plannedMinutes);
  }, [taskId, kind, taskLabel, plannedMinutes, beginFocusSession, openTaskPicker]);

  const startBreak = useCallback(() => {
    beginBreak(plannedMinutes === BREAK_PRESET_MINUTES ? BREAK_PRESET_MINUTES : plannedMinutes);
  }, [beginBreak, plannedMinutes]);

  const togglePause = useCallback(() => {
    if (phase === "running" || phase === "break") {
      const left = endsAt ? remainingSeconds(endsAt) : plannedMinutes * 60;
      setPausedRemaining(left);
      setPhase("paused");
      persist({
        phase: "paused",
        pausedRemainingSeconds: left,
        endsAt: endsAt ?? endsAtFromNow(plannedMinutes),
      });
    } else if (phase === "paused" && pausedRemaining != null) {
      const end = new Date(Date.now() + pausedRemaining * 1000).toISOString();
      setEndsAt(end);
      setPausedRemaining(null);
      setPhase(kind === "break" ? "break" : "running");
      persist({
        phase: kind === "break" ? "break" : "running",
        endsAt: end,
        pausedRemainingSeconds: null,
      });
    }
  }, [phase, endsAt, plannedMinutes, pausedRemaining, kind, persist]);

  const stopSession = useCallback(async () => {
    expiryHandledRef.current = false;
    if (kind === "focus" && (phase === "running" || phase === "paused")) {
      await completeSession("abandoned");
    } else {
      setPhase("idle");
      setEndsAt(null);
      setPausedRemaining(null);
      savePersistedTimer(null);
    }
  }, [kind, phase, completeSession]);

  const endBreak = useCallback(() => {
    expiryHandledRef.current = false;
    setPhase("idle");
    setEndsAt(null);
    setPausedRemaining(null);
    setKind("focus");
    savePersistedTimer(null);
  }, []);

  const resumeLastTask = useCallback(async () => {
    const lastId = loadLastTaskId();
    if (!lastId) return;
    const tasks = await listItems({ type: "task", status: "active", limit: 300 });
    const task = tasks.find((t) => t.id === lastId);
    if (!task) return;
    setTaskId(task.id);
    setTaskLabel(taskPreview(task.content));
    setPlannedMinutes(FOCUS_PRESET_MINUTES);
    setKind("focus");
    await beginFocusSession(task.id, taskPreview(task.content), FOCUS_PRESET_MINUTES);
  }, [beginFocusSession]);

  const value: FocusTimerContextValue = {
    phase,
    taskId,
    taskLabel,
    plannedMinutes,
    kind,
    displaySeconds,
    displayLabel,
    showTaskPicker,
    activeTasks,
    loadingTasks,
    openTaskPicker,
    closeTaskPicker,
    confirmTask,
    setPresetMinutes,
    startWithCurrentTask,
    startBreak,
    togglePause,
    stopSession,
    endBreak,
    resumeLastTask,
    hasLastTask,
    refreshStats: () => onStatsChange?.(),
  };

  return (
    <FocusTimerContext.Provider value={value}>
      {children}
    </FocusTimerContext.Provider>
  );
}

export function useFocusTimer(): FocusTimerContextValue {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) {
    throw new Error("useFocusTimer must be used within FocusTimerProvider");
  }
  return ctx;
}
