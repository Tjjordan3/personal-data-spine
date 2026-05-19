import { useEffect, useRef, useState } from "react";

const VIEW_FADE_MS = 160;

/**
 * Crossfade between views: fade out, swap content, fade in.
 * Uses opacity transitions (reliable in Tauri WebView2) instead of mount keyframes.
 */
export function useViewCrossfade<T>(view: T) {
  const [displayView, setDisplayView] = useState(view);
  const [visible, setVisible] = useState(true);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    if (view === displayView) return;

    setVisible(false);
    const id = window.setTimeout(() => {
      setDisplayView(viewRef.current);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    }, VIEW_FADE_MS);

    return () => window.clearTimeout(id);
  }, [view, displayView]);

  return { displayView, visible, fadeMs: VIEW_FADE_MS };
}
