import { useCallback, useEffect, useState } from "react";
import {
  createLink,
  getRelatedItems,
  linkTypeLabel,
  type LinkType,
} from "../lib/db/links";
import { getItemById } from "../lib/db/items";
import { totalFocusMinutesForTask } from "../lib/db/workBlocks";
import type { Item } from "../lib/db/types";
import { ItemEditForm } from "./ItemEditForm";
import { TaskFocusStartButton } from "./TaskFocusStartButton";

interface RelatedPanelProps {
  item: Item | null;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSelectItem: (id: string) => void;
  onToast: (message: string, kind: "success" | "error") => void;
  onChanged: () => void;
  onNavigateToFocus?: () => void;
}

export function RelatedPanel({
  item,
  editing,
  onEditingChange,
  onSelectItem,
  onToast,
  onChanged,
  onNavigateToFocus,
}: RelatedPanelProps) {
  const [related, setRelated] = useState<
    Awaited<ReturnType<typeof getRelatedItems>>
  >([]);
  const [linkTargetId, setLinkTargetId] = useState("");
  const [linkType, setLinkType] = useState<LinkType>("related");
  const [loading, setLoading] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!item) {
      setRelated([]);
      return;
    }
    setLoading(true);
    try {
      setRelated(await getRelatedItems(item.id));
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!item || item.type !== "task") {
      setFocusMinutes(null);
      return;
    }
    void totalFocusMinutesForTask(item.id).then(setFocusMinutes);
  }, [item]);

  async function handleAddLink() {
    if (!item || !linkTargetId.trim()) return;
    try {
      const target = await getItemById(linkTargetId.trim());
      if (!target) {
        onToast("Target item ID not found.", "error");
        return;
      }
      await createLink(item.id, target.id, linkType);
      if (linkType === "related") {
        await createLink(target.id, item.id, "related");
      }
      setLinkTargetId("");
      onToast("Link created (bidirectional related).", "success");
      onChanged();
      void refresh();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to link", "error");
    }
  }

  if (!item) {
    return (
      <aside className="w-72 shrink-0 border-l border-pds-border p-4 text-sm text-pds-muted">
        Select an item to see related links.
      </aside>
    );
  }

  if (editing) {
    return (
      <aside className="flex w-72 shrink-0 flex-col overflow-auto border-l border-pds-border">
        <ItemEditForm
          item={item}
          onSaved={(updated) => {
            onEditingChange(false);
            onChanged();
            onSelectItem(updated.id);
          }}
          onCancel={() => onEditingChange(false)}
          onToast={onToast}
          onNavigateToFocus={onNavigateToFocus}
        />
      </aside>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-pds-border">
      <div className="border-b border-pds-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xs font-medium uppercase tracking-wide text-pds-muted">
              Related items
            </h2>
            <p className="mt-1 truncate text-[11px] text-pds-muted">
              {item.type} · {item.id.slice(0, 8)}…
              {item.type === "task" && focusMinutes != null && focusMinutes > 0 && (
                <> · {focusMinutes} min focus</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onEditingChange(true)}
            className="shrink-0 rounded border border-pds-border px-2 py-0.5 text-[10px] text-pds-muted hover:bg-pds-chip"
          >
            Edit
          </button>
        </div>
      </div>
      {item.type === "task" && (
        <div className="border-b border-pds-border p-3">
          <TaskFocusStartButton task={item} onNavigateToFocus={onNavigateToFocus} />
        </div>
      )}
      <div className="space-y-2 border-b border-pds-border p-3">
        <input
          value={linkTargetId}
          onChange={(e) => setLinkTargetId(e.target.value)}
          placeholder="Paste item ID to link"
          className="w-full rounded border border-pds-border bg-pds-input px-2 py-1 text-[11px] text-pds-text"
        />
        <select
          value={linkType}
          onChange={(e) => setLinkType(e.target.value as LinkType)}
          className="w-full rounded border border-pds-border bg-pds-input px-2 py-1 text-[11px] text-pds-text"
        >
          <option value="related">related</option>
          <option value="source">source</option>
          <option value="references">references</option>
          <option value="action_of">action_of</option>
          <option value="has_action">has_action</option>
        </select>
        <button
          type="button"
          onClick={() => void handleAddLink()}
          className="w-full rounded bg-zinc-100 py-1 text-[11px] font-medium text-zinc-900"
        >
          Add link
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {loading && (
          <p className="px-2 py-4 text-[11px] text-pds-muted">Loading…</p>
        )}
        {!loading && related.length === 0 && (
          <p className="px-2 py-4 text-[11px] text-pds-muted">No links yet.</p>
        )}
        <ul className="space-y-1.5">
          {related.map(({ item: rel, link, direction }) => (
            <li key={`${link.id}-${rel.id}`}>
              <button
                type="button"
                onClick={() => onSelectItem(rel.id)}
                className="w-full rounded border border-pds-border bg-pds-panel/50 px-2 py-1.5 text-left hover:border-pds-border"
              >
                <span className="text-[10px] uppercase text-pds-muted">
                  {rel.type} · {direction} · {linkTypeLabel(link.link_type)}
                </span>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-pds-text">
                  {rel.content}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
