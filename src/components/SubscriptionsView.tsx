import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getItemById, listItems } from "../lib/db/items";
import { getItemStatus, type ItemStatus } from "../lib/db/itemStatus";
import { todayKey } from "../lib/db/dates";
import {
  getCategoryById,
  SUBSCRIPTION_CADENCE_OPTIONS,
} from "../lib/subscriptions/catalog";
import {
  classifyRenewal,
  renewalDateKey,
  renewalListHint,
  renewalUrgencyLabel,
  type RenewalUrgency,
} from "../lib/subscriptions/renewals";
import type { Item } from "../lib/db/types";
import { AddSubscriptionPicker } from "./AddSubscriptionPicker";
import { EmptyState } from "./EmptyState";
import { ItemEditForm } from "./ItemEditForm";
import { RelatedPanel } from "./RelatedPanel";

interface SubscriptionsViewProps {
  onToast: (message: string, kind: "success" | "error") => void;
  initialShowAdd?: boolean;
  onInitialShowAddConsumed?: () => void;
  initialSelectedId?: string | null;
  onInitialSelectedConsumed?: () => void;
}

function urgencyBadgeClass(urgency: RenewalUrgency | null): string {
  if (urgency === "overdue") return "text-red-400";
  if (urgency === "today") return "text-amber-400";
  if (urgency === "soon") return "text-sky-300";
  return "text-pds-subtle";
}

function SubscriptionDetailView({ item }: { item: Item }) {
  const renewal = item.metadata.renewal_date as string | null | undefined;
  const amount = item.metadata.amount as string | number | null | undefined;
  const cadence = item.metadata.cadence as string | null | undefined;
  const categoryId = item.metadata.category as string | undefined;
  const notes = (item.metadata.notes as string | null | undefined)?.trim();
  const categoryLabel = categoryId
    ? (getCategoryById(categoryId)?.label ??
      (categoryId === "custom" ? "Custom" : categoryId))
    : "";
  const cadenceLabel =
    SUBSCRIPTION_CADENCE_OPTIONS.find((o) => o.value === cadence)?.label ??
    cadence;

  const renewalKey = renewal ? renewalDateKey(item) : null;
  const urgency = renewalKey ? classifyRenewal(renewalKey) : null;

  const detailRows: { label: string; value: string }[] = [];
  if (categoryLabel) {
    detailRows.push({ label: "Category", value: categoryLabel });
  }
  if (renewal) {
    detailRows.push({ label: "Renewal", value: renewal });
  }
  if (amount != null && amount !== "") {
    detailRows.push({ label: "Cost", value: `$${amount}` });
  }
  if (cadenceLabel) {
    detailRows.push({ label: "Cadence", value: String(cadenceLabel) });
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      {urgency && renewalKey && (
        <p
          className={`mb-3 text-pds-sm font-medium ${urgencyBadgeClass(urgency)}`}
        >
          {renewalUrgencyLabel(urgency)}
          {urgency !== "today" && (
            <span className="font-normal text-pds-muted">
              {" "}
              · {renewalListHint(renewalKey) ?? renewalKey}
            </span>
          )}
        </p>
      )}
      {detailRows.length > 0 && (
        <dl className="space-y-1.5 text-pds-base">
          {detailRows.map((row) => (
            <div key={row.label} className="flex gap-2">
              <dt className="w-20 shrink-0 text-pds-sm uppercase text-pds-muted">
                {row.label}
              </dt>
              <dd className="text-pds-text">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {notes ? (
        <div className="pds-card mt-4 p-3">
          <h3 className="text-pds-sm font-medium uppercase text-pds-muted">
            Notes
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-pds-base leading-relaxed text-pds-text">
            {notes}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-pds-base text-pds-muted">No notes.</p>
      )}
      {item.tags.length > 0 && (
        <p className="mt-4 text-pds-sm text-pds-muted">{item.tags.join(" ")}</p>
      )}
    </div>
  );
}

function DetailHeader({ item, onEdit }: { item: Item; onEdit: () => void }) {
  const status = getItemStatus(item);
  const renewalKey = renewalDateKey(item);
  const hint = renewalKey ? renewalListHint(renewalKey) : null;
  return (
    <div className="border-b border-pds-border px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-pds-base font-semibold text-pds-text">
            {item.content}
          </h2>
          <p className="mt-0.5 text-pds-sm text-pds-muted">
            subscription
            {status !== "active" ? ` · ${status}` : ""}
            {hint ? ` · ${hint}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded border border-pds-border px-3 py-1 text-pds-sm text-pds-muted hover:bg-pds-chip"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

export function SubscriptionsView({
  onToast,
  initialShowAdd = false,
  onInitialShowAddConsumed,
  initialSelectedId = null,
  onInitialSelectedConsumed,
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

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
      setShowAdd(false);
      onInitialSelectedConsumed?.();
    }
  }, [initialSelectedId, onInitialSelectedConsumed]);

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
      setError(
        err instanceof Error ? err.message : "Failed to load subscriptions",
      );
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
          String(item.metadata.renewal_date ?? ""),
          String(item.metadata.notes ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : items;

  const today = todayKey();
  const sorted = [...filtered].sort((a, b) => {
    const aKey = renewalDateKey(a);
    const bKey = renewalDateKey(b);
    if (aKey && bKey) return aKey.localeCompare(bKey);
    if (aKey) return -1;
    if (bKey) return 1;
    return a.content.localeCompare(b.content);
  });

  function startAddSubscription() {
    setSelectedId(null);
    setSelectedItem(null);
    setEditing(false);
    setShowAdd(true);
  }

  async function handleRelatedSelect(id: string) {
    const item = await getItemById(id);
    if (item?.type === "subscription") {
      setEditing(false);
      setShowAdd(false);
      setSelectedId(id);
      return;
    }
    onToast("Open linked items from the Inbox tab.", "success");
  }

  const subscriptionDetail =
    selectedItem?.type === "subscription" ? selectedItem : null;

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-pds-border">
        <div className="border-b border-pds-border px-3 py-3">
          <h2 className="text-pds-base font-semibold text-pds-text">
            Subscriptions
          </h2>
          <p className="text-pds-caption text-pds-muted">
            Renewals and recurring services
          </p>
          <button
            type="button"
            onClick={startAddSubscription}
            className="pds-btn-primary mt-2 w-full px-2 py-1.5 text-pds-sm"
          >
            Add subscription
          </button>
        </div>
        <div className="space-y-2 border-b border-pds-border px-3 py-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subscriptions…"
            className="w-full rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-pds-sm text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
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
                className={`rounded px-2 py-0.5 text-pds-caption ${
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
        <ul className="min-h-0 flex-1 overflow-auto p-2">
          {loading && (
            <li className="px-2 py-4 text-pds-sm text-pds-muted">Loading…</li>
          )}
          {error && (
            <li className="rounded border border-red-900/50 bg-red-950/40 px-2 py-2 text-pds-sm text-red-300">
              {error}
            </li>
          )}
          {!loading && !error && sorted.length === 0 && (
            <li className="px-2 py-2">
              <EmptyState
                title="No subscriptions yet"
                description="Add from the curated catalog or enter a custom name."
                className="py-6"
              >
                <button
                  type="button"
                  onClick={startAddSubscription}
                  className="pds-btn-primary px-3 py-1.5 text-pds-sm"
                >
                  Add subscription
                </button>
              </EmptyState>
            </li>
          )}
          {sorted.map((item) => {
            const selected = selectedId === item.id;
            const itemStatus = getItemStatus(item);
            const rKey = renewalDateKey(item);
            const hint = rKey ? renewalListHint(rKey, today) : null;
            const urgency = rKey ? classifyRenewal(rKey, today) : null;
            const amount = item.metadata.amount as string | number | undefined;
            return (
              <li key={item.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setShowAdd(false);
                    setSelectedId(item.id);
                  }}
                  className={`w-full px-2 py-2 text-left text-pds-sm transition ${
                    selected
                      ? "pds-list-item-selected text-pds-text"
                      : "pds-list-item text-pds-text"
                  }`}
                >
                  <p className="font-medium leading-snug">{item.content}</p>
                  <p className="mt-1 flex flex-wrap gap-x-1 text-pds-caption">
                    {rKey && (
                      <span className={urgencyBadgeClass(urgency)}>
                        {rKey}
                      </span>
                    )}
                    {hint && (
                      <span className="text-pds-subtle">· {hint}</span>
                    )}
                    {amount != null && amount !== "" && (
                      <span className="text-pds-subtle">· ${amount}</span>
                    )}
                    {itemStatus !== "active" && (
                      <span className="text-pds-subtle">· {itemStatus}</span>
                    )}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto border-r border-pds-border">
        <div
          key={`${selectedId ?? "compose"}-${editing ? "edit" : "view"}-${showAdd ? "add" : ""}`}
          className="pds-view-enter flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {showAdd && !selectedId ? (
            <AddSubscriptionPicker
              onClose={() => setShowAdd(false)}
              onCreated={(item) => {
                setSelectedId(item.id);
                setShowAdd(false);
                void refresh();
              }}
              onToast={onToast}
            />
          ) : !selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6">
              <EmptyState
                title="Select a subscription"
                description="Pick one from the list or add a new subscription."
              >
                <button
                  type="button"
                  onClick={startAddSubscription}
                  className="pds-btn-primary px-3 py-1.5 text-pds-sm"
                >
                  Add subscription
                </button>
              </EmptyState>
            </div>
          ) : !selectedItem ? (
            <p className="p-4 text-pds-base text-pds-muted">Loading…</p>
          ) : editing ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <ItemEditForm
                item={selectedItem}
                onSaved={(updated) => {
                  setEditing(false);
                  setSelectedId(updated.id);
                  void refresh();
                }}
                onCancel={() => setEditing(false)}
                onToast={onToast}
              />
            </div>
          ) : subscriptionDetail ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <DetailHeader
                item={subscriptionDetail}
                onEdit={() => setEditing(true)}
              />
              <SubscriptionDetailView item={subscriptionDetail} />
            </div>
          ) : (
            <p className="p-4 text-pds-base text-pds-muted">
              Selected item is not a subscription.
            </p>
          )}
        </div>
      </main>

      <RelatedPanel
        item={subscriptionDetail}
        editing={editing}
        onEditingChange={setEditing}
        onSelectItem={(id) => void handleRelatedSelect(id)}
        onToast={onToast}
        onChanged={() => void refresh()}
      />
    </div>
  );
}
