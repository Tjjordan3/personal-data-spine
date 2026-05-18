import { loadSettings } from "../settings";

export type TimerChimeKind = "focus_complete" | "break_complete";

let audioContext: AudioContext | null = null;
let unlockListenersAttached = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  return audioContext;
}

/** Call after a user gesture so completion chimes work in background tabs. */
export function unlockTimerAudio(): void {
  const ctx = getAudioContext();
  if (!ctx || ctx.state === "running") return;
  void ctx.resume();
}

function attachUnlockListeners(): void {
  if (unlockListenersAttached || typeof window === "undefined") return;
  unlockListenersAttached = true;
  const unlock = () => {
    unlockTimerAudio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  gainPeak: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

/**
 * Short chime when a Pomodoro segment ends naturally.
 * Browsers may block audio until the user has interacted with the page once.
 */
export function playTimerChime(kind: TimerChimeKind): void {
  if (!loadSettings().timerChime) return;

  attachUnlockListeners();
  const ctx = getAudioContext();
  if (!ctx) return;

  void ctx.resume().then(() => {
    const t = ctx.currentTime;
    if (kind === "focus_complete") {
      playTone(ctx, 523.25, t, 0.35, 0.12);
      playTone(ctx, 659.25, t + 0.12, 0.4, 0.1);
    } else {
      playTone(ctx, 392, t, 0.3, 0.11);
      playTone(ctx, 493.88, t + 0.1, 0.35, 0.09);
    }
  });
}
