import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { emit } from "@tauri-apps/api/event";
import { deleteItem, insertItem } from "../lib/db/items";
import { NOTE_TEMPLATES } from "../lib/capture/templates";
import { TagAddField } from "./TagAddField";

const MAX_UNDO = 20;

export interface CaptureFormHandle {
  reset: () => void;
  focusInput: () => void;
}

export interface CaptureFormProps {
  variant: "floating" | "inline";
  onSaved?: () => void;
  onClose?: () => void;
  focusToken?: number;
}

export const CaptureForm = forwardRef<CaptureFormHandle, CaptureFormProps>(
  function CaptureForm({ variant, onSaved, onClose, focusToken }, ref) {
    const [text, setText] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);
    const [undoStack, setUndoStack] = useState<string[]>([]);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const resetForm = useCallback(() => {
      setText("");
      setTags([]);
      setError(null);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        reset: resetForm,
        focusInput: () => inputRef.current?.focus(),
      }),
      [resetForm],
    );

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
        onSaved?.();
        requestAnimationFrame(() => inputRef.current?.focus());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save note");
      } finally {
        setSaving(false);
      }
    }, [text, tags, resetForm, onSaved]);

    const undo = useCallback(async () => {
      if (undoStack.length === 0) return;
      const [lastId, ...rest] = undoStack;
      try {
        await deleteItem(lastId);
        setUndoStack(rest);
        await emit("item:saved", {});
        setSavedFlash(true);
        globalThis.setTimeout(() => setSavedFlash(false), 600);
        onSaved?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Undo failed");
      }
    }, [undoStack, onSaved]);

    const handleClose = useCallback(() => {
      resetForm();
      onClose?.();
    }, [resetForm, onClose]);

    useEffect(() => {
      if (focusToken === undefined) return;
      resetForm();
      requestAnimationFrame(() => inputRef.current?.focus());
    }, [focusToken, resetForm]);

    useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape" && onClose) {
          event.preventDefault();
          handleClose();
          return;
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
    }, [handleClose, onClose, save, undo]);

    const isFloating = variant === "floating";
    const placeholder = isFloating
      ? "Quick capture. Enter saves, Esc closes, Ctrl+Z undo."
      : "Enter saves, Esc closes, Ctrl+Z undo.";

    return (
      <div
        className={`flex min-h-0 flex-col ${
          isFloating ? "min-h-[120px] flex-1" : ""
        } ${savedFlash ? "rounded-sm ring-1 ring-emerald-600/60" : ""}`}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {NOTE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setText(t.body)}
                className="rounded-sm border border-pds-border px-1.5 py-0.5 text-[10px] text-pds-muted hover:bg-pds-chip"
              >
                {t.label}
              </button>
            ))}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={handleClose}
              className="shrink-0 rounded-sm px-1.5 py-0.5 text-pds-sm leading-none text-pds-muted hover:bg-pds-chip hover:text-pds-text"
              aria-label="Close capture"
            >
              ×
            </button>
          )}
        </div>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={saving}
          rows={isFloating ? 4 : 3}
          className={`w-full rounded-sm border border-pds-border bg-pds-input px-2.5 py-2 text-sm text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none ${
            isFloating
              ? "min-h-[72px] flex-1 resize-y"
              : "resize-none"
          }`}
        />
        <TagAddField
          className="mt-2"
          tags={tags}
          onChange={setTags}
          disabled={saving}
          trailing={
            <button
              type="button"
              onClick={() => void undo()}
              disabled={undoStack.length === 0}
              className="rounded-sm border border-pds-border px-2 py-1 text-pds-sm text-pds-muted hover:bg-pds-chip disabled:opacity-40"
              title="Undo last save (Ctrl+Z)"
            >
              Undo
            </button>
          }
        />
        {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
      </div>
    );
  },
);
