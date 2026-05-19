import { useEffect, useRef, useState } from "react";

/** Keep mounted while exit animation runs after `active` becomes false. */
export function useAnimatedPresence(
  active: boolean,
  exitDurationMs: number,
): { mounted: boolean; exiting: boolean } {
  const [mounted, setMounted] = useState(active);
  const [exiting, setExiting] = useState(false);
  const mountedRef = useRef(mounted);

  useEffect(() => {
    mountedRef.current = mounted;
  }, [mounted]);

  useEffect(() => {
    if (active) {
      setMounted(true);
      setExiting(false);
      return;
    }

    if (!mountedRef.current) return;

    setExiting(true);
    const id = window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, exitDurationMs);

    return () => window.clearTimeout(id);
  }, [active, exitDurationMs]);

  return { mounted, exiting };
}
