import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { deleteItem, insertItem } from "../lib/db/items";

const MAX_UNDO = 20;

function normalizeTag(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  return t.startsWith("#") ? t : `#${t}`;
}

export function Capture() {
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tauriWindow = getCurrentWindow();

  const resetForm = useCallback(() => {
    setText("");
    setTags([]);
    setTagInput("");
    setError(null);
  }, []);

  const save = useCallback(async () => {
    const content = text.trim();
    if (!content) return;

    setSaving(true);
    setError(null);
    try {
      const mergedTags = [
        ...new Set([
          ...tags,
          ...(content.match(/#[\w-]+/gi)?.map((t) => t.toLowerCase()) ?? []),
        ]),
      ].slice(0, 8);

      const saved = await insertItem({
        type: "note",
        content,
        tags: mergedTags,
        source: "quick-capture",
        metadata: {},
      });

      setUndoStack((prev) => [saved.id, ...prev].slice(0, MAX_UNDO));
      await emit("item:saved", {});
      resetForm();
      setSavedFlash(true);
      globalThis.setTimeout(() => setSavedFlash(false), 800);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }, [text, tags, resetForm]);

  const undo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const [lastId, ...rest] = undoStack;
    try {
      await deleteItem(lastId);
      setUndoStack(rest);
      await emit("item:saved", {});
      setSavedFlash(true);
      globalThis.setTimeout(() => setSavedFlash(false), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed");
    }
  }, [undoStack]);

  const hide = useCallback(async () => {
    resetForm();
    await tauriWindow.hide();
  }, [tauriWindow, resetForm]);

  function addTagFromInput() {
    const tag = normalizeTag(tagInput);
    if (!tag) return;
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]).slice(0, 8));
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  useEffect(() => {
    const unlistenShow = listen("capture:focus", () => {
      resetForm();
      requestAnimationFrame(() => inputRef.current?.focus());
    });
    return () => {
      void unlistenShow.then((fn) => fn());
    };
  }, [resetForm]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void hide();
      }
      if (event.key === "Enter" && !event.shiftKey) {
        const target = event.target as HTMLElement;
        if (target.tagName === "INPUT") return;
        event.preventDefault();
        void save();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void undo();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hide, save, undo]);

  useEffect(() => {
    void tauriWindow.isVisible().then((visible) => {
      if (visible) inputRef.current?.focus();
    });
    const unlisten = tauriWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) inputRef.current?.focus();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [tauriWindow]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent p-2">
      <div
        className={`w-full max-w-[420px] rounded-lg border bg-pds-panel/95 p-2 shadow-2xl backdrop-blur-sm transition ${
          savedFlash ? "border-emerald-600" : "border-pds-border/80"
        }`}
      >
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Quick capture. Enter saves, Esc closes, Ctrl+Z undo."
          disabled={saving}
          rows={3}
          className="w-full resize-none rounded border border-pds-border bg-pds-input px-2.5 py-2 text-sm text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded bg-pds-chip px-1.5 py-0.5 text-[10px] text-pds-muted"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-pds-muted hover:text-red-400"
                aria-label={`Remove ${tag}`}
              >
                x
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTagFromInput();
              }
            }}
            placeholder="Add tag"
            className="min-w-0 flex-1 rounded border border-pds-border bg-pds-input px-2 py-1 text-[11px] text-pds-text"
          />
          <button
            type="button"
            onClick={addTagFromInput}
            className="rounded border border-pds-border px-2 py-1 text-[11px] text-pds-muted"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => void undo()}
            disabled={undoStack.length === 0}
            className="rounded border border-pds-border px-2 py-1 text-[11px] text-pds-muted disabled:opacity-40"
            title="Undo last save (Ctrl+Z)"
          >
            Undo
          </button>
        </div>
        {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
      </div>
    </div>
  );
}
