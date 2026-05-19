import { useEffect, useRef, useState } from "react";

/** Keep mounted while exit transition runs after `active` becomes false. */
export function useAnimatedPresence(
  active: boolean,
  exitDurationMs: number,
): { mounted: boolean; exiting: boolean; entered: boolean } {
  const [mounted, setMounted] = useState(active);
  const [exiting, setExiting] = useState(false);
  const [entered, setEntered] = useState(active);
  const mountedRef = useRef(mounted);

  useEffect(() => {
    mountedRef.current = mounted;
  }, [mounted]);

  useEffect(() => {
    if (active) {
      setMounted(true);
      setExiting(false);
      setEntered(false);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setEntered(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }

    if (!mountedRef.current) return;

    setEntered(false);
    setExiting(true);
    const id = window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, exitDurationMs);

    return () => window.clearTimeout(id);
  }, [active, exitDurationMs]);

  return { mounted, exiting, entered };
}
