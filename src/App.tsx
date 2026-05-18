import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { ItemList } from "./components/ItemList";
import { MeetingMode } from "./components/MeetingMode";
import { SettingsPanel } from "./components/SettingsPanel";
import type { ItemStatus } from "./lib/db/itemStatus";
import { listItems, searchItems } from "./lib/db/items";
import type { Item, ItemType } from "./lib/db/types";

type View = "inbox" | "meeting" | "settings";

const TYPE_FILTERS: Array<{ label: string; value: ItemType | "all" }> = [
  { label: "All", value: "all" },
  { label: "Notes", value: "note" },
  { label: "Meetings", value: "meeting" },
  { label: "Tasks", value: "task" },
];

const TAG_FILTERS = [
  "all",
  "#urgent",
  "#meeting",
  "#task",
  "#bug",
  "#idea",
] as const;

export default function App() {
  const [view, setView] = useState<View>("inbox");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("active");
  const [toast, setToast] = useState<{
    message: string;
    kind: "success" | "error";
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback(
    (message: string, kind: "success" | "error") => {
      setToast({ message, kind });
      window.setTimeout(() => setToast(null), 4000);
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data: Item[];
      if (query.trim()) {
        data = await searchItems(query.trim(), statusFilter);
      } else {
        data = await listItems({
          type: typeFilter === "all" ? undefined : typeFilter,
          tag: tagFilter === "all" ? undefined : tagFilter,
          status: statusFilter,
        });
      }
      if (query.trim() && typeFilter !== "all") {
        data = data.filter((item) => item.type === typeFilter);
      }
      if (query.trim() && tagFilter !== "all") {
        data = data.filter((item) =>
          item.tags.some(
            (t) => t.toLowerCase() === tagFilter.toLowerCase(),
          ),
        );
      }
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
  }, [query, typeFilter, tagFilter, statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unlisten = listen("item:saved", () => {
      void refresh();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refresh]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && view === "inbox") {
        const target = event.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
          return;
        }
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
          Personal Data Spine
        </h1>
        <nav className="ml-auto flex gap-1">
          {(
            [
              ["inbox", "Inbox"],
              ["meeting", "Meeting"],
              ["settings", "Settings"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`rounded px-2.5 py-1 text-xs ${
                view === id
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {toast && (
        <p
          className={`mx-4 mt-2 rounded px-3 py-2 text-xs ${
            toast.kind === "success"
              ? "bg-emerald-950/60 text-emerald-300"
              : "bg-red-950/60 text-red-300"
          }`}
        >
          {toast.message}
        </p>
      )}

      {view === "inbox" && (
        <>
          <div className="border-b border-zinc-800 px-4 py-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search… (/ to focus)"
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2 border-b border-zinc-800 px-4 py-2">
            {TYPE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setTypeFilter(filter.value)}
                className={`rounded px-2 py-0.5 text-[11px] ${
                  typeFilter === filter.value
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-900 text-zinc-400"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-b border-zinc-800 px-4 py-2">
            {(
              [
                ["active", "Active"],
                ["done", "Done"],
                ["archived", "Archived"],
                ["all", "All statuses"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded px-2 py-0.5 text-[11px] ${
                  statusFilter === value
                    ? "bg-emerald-700 text-white"
                    : "bg-zinc-900 text-zinc-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-b border-zinc-800 px-4 py-2">
            {TAG_FILTERS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tag)}
                className={`rounded px-2 py-0.5 text-[11px] ${
                  tagFilter === tag
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-900 text-zinc-400"
                }`}
              >
                {tag === "all" ? "All tags" : tag}
              </button>
            ))}
          </div>
          <main className="min-h-0 flex-1 overflow-auto">
            <ItemList
              items={items}
              loading={loading}
              error={error}
              onChanged={() => void refresh()}
              onToast={showToast}
            />
          </main>
        </>
      )}

      {view === "meeting" && (
        <main className="min-h-0 flex-1 overflow-auto">
          <MeetingMode
            onSaved={() => void refresh()}
            onError={(msg) => showToast(msg, "error")}
            onSuccess={(msg) => showToast(msg, "success")}
          />
        </main>
      )}

      {view === "settings" && (
        <main className="min-h-0 flex-1 overflow-auto">
          <SettingsPanel
            onClose={() => setView("inbox")}
            onToast={showToast}
          />
        </main>
      )}
    </div>
  );
}
