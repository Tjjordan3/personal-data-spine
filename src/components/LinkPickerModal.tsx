import { useCallback, useEffect, useState } from "react";
import { searchWithFacets } from "../lib/db/search";
import { meetingTitle } from "../lib/meeting/display";
import type { Item } from "../lib/db/types";
import type { LinkType } from "../lib/db/links";

function itemLabel(item: Item): string {
  if (item.type === "meeting") return meetingTitle(item);
  const line = item.content.replace(/\s+/g, " ").trim();
  return line.length > 72 ? `${line.slice(0, 72)}…` : line || item.type;
}

interface LinkPickerModalProps {
  open: boolean;
  sourceItem: Item;
  linkType: LinkType;
  onClose: () => void;
  onPick: (targetId: string) => void | Promise<void>;
}

export function LinkPickerModal({
  open,
  sourceItem,
  linkType,
  onClose,
  onPick,
}: LinkPickerModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const search = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const rows = await searchWithFacets({
        query: query.trim() || undefined,
        status: "all",
      });
      setResults(
        rows
          .map((r) => r.item)
          .filter((i) => i.id !== sourceItem.id)
          .slice(0, 40),
      );
      setHighlight(0);
    } finally {
      setLoading(false);
    }
  }, [open, query, sourceItem.id]);

  useEffect(() => {
    const id = window.setTimeout(() => void search(), query.trim() ? 120 : 0);
    return () => window.clearTimeout(id);
  }, [search, query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, Math.max(0, results.length - 1)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      }
      if (e.key === "Enter" && results[highlight]) {
        e.preventDefault();
        void onPick(results[highlight].id);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onPick, results, highlight]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Link to item"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-pds-border bg-pds-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-pds-border px-3 py-2">
          <p className="text-xs font-medium text-pds-text">Link to item</p>
          <p className="text-[10px] text-pds-muted">
            Type: {linkType} · Esc to cancel
          </p>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or content…"
          className="w-full border-b border-pds-border bg-pds-input px-3 py-2 text-sm text-pds-text placeholder:text-pds-subtle focus:outline-none"
        />
        <ul className="max-h-64 overflow-auto p-1">
          {loading && (
            <li className="px-3 py-4 text-center text-[11px] text-pds-muted">
              Searching…
            </li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-4 text-center text-[11px] text-pds-muted">
              No items found.
            </li>
          )}
          {results.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void onPick(item.id)}
                className={`w-full rounded px-3 py-2 text-left text-[11px] ${
                  index === highlight
                    ? "bg-violet-950/40 text-pds-text"
                    : "text-pds-text hover:bg-pds-chip"
                }`}
              >
                <span className="text-[10px] uppercase text-pds-muted">
                  {item.type}
                </span>
                <p className="mt-0.5 line-clamp-2">{itemLabel(item)}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
