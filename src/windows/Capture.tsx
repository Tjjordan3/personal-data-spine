import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { insertItem } from "../lib/db/items";
import { detectTags } from "../lib/tags/keywordTagger";

export function Capture() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const window = getCurrentWindow();

  const hide = useCallback(async () => {
    setText("");
    setError(null);
    await window.hide();
  }, [window]);

  const save = useCallback(async () => {
    const content = text.trim();
    if (!content) {
      await hide();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await insertItem({
        type: "note",
        content,
        tags: detectTags(content),
        source: "quick-capture",
        metadata: {},
      });
      await emit("item:saved", {});
      await hide();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }, [text, hide]);

  useEffect(() => {
    const unlistenShow = listen("capture:focus", () => {
      setText("");
      setError(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    });

    return () => {
      void unlistenShow.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void hide();
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void save();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hide, save]);

  useEffect(() => {
    void window.isVisible().then((visible) => {
      if (visible) inputRef.current?.focus();
    });
    const unlisten = window.onFocusChanged(({ payload: focused }) => {
      if (focused) inputRef.current?.focus();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [window]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent p-2">
      <div className="w-full max-w-[400px] rounded-lg border border-zinc-700/80 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-sm">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Quick capture… Enter to save, Esc to dismiss"
          disabled={saving}
          rows={3}
          className="w-full resize-none rounded border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
        {error && (
          <p className="mt-1 text-[11px] text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
