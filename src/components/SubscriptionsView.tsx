import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getItemById, listItems } from "../lib/db/items";
import type { ItemStatus } from "../lib/db/itemStatus";
import { getCategoryById } from "../lib/subscriptions/catalog";
import type { Item } from "../lib/db/types";
import type { SearchResult } from "../lib/db/search";
import { AddSubscriptionPicker } from "./AddSubscriptionPicker";
import { ItemList } from "./ItemList";
import { RelatedPanel } from "./RelatedPanel";

interface SubscriptionsViewProps {
  onToast: (message: string, kind: "success" | "error") => void;
  initialShowAdd?: boolean;
  onInitialShowAddConsumed?: () => void;
}

export function SubscriptionsView({
  onToast,
  initialShowAdd = false,
  onInitialShowAddConsumed,
}: SubscriptionsViewProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ItemStatus | "all">("active");
  const [showAdd, setShowAdd] = useState(initialShowAdd);

  useEffect(() => {
    if (initialShowAdd) {
      setShowAdd(true);
      onInitialShowAddConsumed?.();
    }
  }, [initialShowAdd, onInitialShowAddConsumed]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listItems({
        type: "subscription",
        status,
        limit: 500,
      });
      setItems(rows);
      if (selectedId) {
        const item = await getItemById(selectedId);
        setSelectedItem(item);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }, [selectedId, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedItem(null);
      setEditing(false);
      return;
    }
    void getItemById(selectedId).then(setSelectedItem);
  }, [selectedId]);

  useEffect(() => {
    const unlisten = listen("item:saved", () => {
      void refresh();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refresh]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? items.filter((item) => {
        const categoryId = item.metadata.category as string | undefined;
        const categoryLabel = categoryId
          ? (getCategoryById(categoryId)?.label ?? "")
          : "";
        const haystack = [
          item.content,
          categoryLabel,
          item.tags.join(" "),
          String(item.metadata.amount ?? ""),
          String(item.metadata.cadence ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : items;

  const results: SearchResult[] = filtered.map((item) => ({
    item,
    reasons: [],
  }));

  function handleEditItem(id: string) {
    setSelectedId(id);
    setEditing(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-pds-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-pds-text">Subscriptions</h2>
          <p className="text-[11px] text-pds-muted">
            Track renewals and recurring services.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            showAdd
              ? "border border-pds-border text-pds-muted"
              : "pds-chip-active"
          }`}
        >
          {showAdd ? "Close picker" : "Add subscription"}
        </button>
      </div>

      {showAdd && (
        <AddSubscriptionPicker
          onClose={() => setShowAdd(false)}
          onCreated={(item) => {
            setSelectedId(item.id);
            setShowAdd(false);
            void refresh();
          }}
          onToast={onToast}
        />
      )}

      <div className="space-y-2 border-b border-pds-border px-4 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subscriptions…"
          className="w-full rounded border border-pds-border bg-pds-panel px-3 py-2 text-sm text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
        />
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["active", "Active"],
              ["done", "Done"],
              ["archived", "Archived"],
              ["all", "All"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded px-2 py-0.5 text-[11px] ${
                status === value
                  ? "bg-pds-accent text-pds-accent-fg"
                  : "bg-pds-chip text-pds-chip-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <main className="min-h-0 flex-1 overflow-auto">
          <ItemList
            results={results}
            selectedId={selectedId}
            onSelect={(id) => {
              setEditing(false);
              setSelectedId(id);
            }}
            loading={loading}
            error={error}
            onChanged={() => void refresh()}
            onToast={onToast}
            onEdit={handleEditItem}
            emptyMessage="No subscriptions yet. Add one from the curated list or enter a custom name."
          />
        </main>
        <RelatedPanel
          item={selectedItem}
          editing={editing}
          onEditingChange={setEditing}
          onSelectItem={(id) => {
            setEditing(false);
            setSelectedId(id);
          }}
          onToast={onToast}
          onChanged={() => void refresh()}
        />
      </div>
    </div>
  );
}
