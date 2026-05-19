import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  checkSubscriptionRenewalReminders,
  registerRenewalNotificationActions,
} from "./lib/subscriptions/renewalReminders";
import { ItemList } from "./components/ItemList";
import { FocusView } from "./components/FocusView";
import { RelatedPanel } from "./components/RelatedPanel";
import { FocusTimerProvider } from "./components/FocusTimerContext";
import {
  SearchFacetsBar,
  type FacetState,
} from "./components/SearchFacetsBar";
import { QuickCreateForm } from "./components/QuickCreateForm";
import {
  CommandPalette,
  useCommandPaletteShortcut,
  type AppView,
} from "./components/CommandPalette";
import { ThemeToggle } from "./components/ThemeToggle";
import { NavViewIcon } from "./components/icons/NavIcon";
import type { GraphScope } from "./lib/db/graph";
import type { ItemType } from "./lib/db/types";
import { getItemById, markItemsDone } from "./lib/db/items";
import { searchWithFacets, type SearchResult } from "./lib/db/search";
import type { Item } from "./lib/db/types";
import { useViewCrossfade } from "./lib/useViewCrossfade";

type View = AppView;

const GraphView = lazy(() =>
  import("./components/GraphView").then((m) => ({ default: m.GraphView })),
);
const MeetingsView = lazy(() =>
  import("./components/MeetingsView").then((m) => ({ default: m.MeetingsView })),
);
const ProjectsView = lazy(() =>
  import("./components/ProjectsView").then((m) => ({ default: m.ProjectsView })),
);
const SubscriptionsView = lazy(() =>
  import("./components/SubscriptionsView").then((m) => ({
    default: m.SubscriptionsView,
  })),
);
const SettingsPanel = lazy(() =>
  import("./components/SettingsPanel").then((m) => ({
    default: m.SettingsPanel,
  })),
);

function DeferredRouteFallback() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-pds-bg px-4">
      <p className="text-pds-sm text-pds-muted">Loading…</p>
    </div>
  );
}

const DEFAULT_FACETS: FacetState = {
  query: "",
  type: "all",
  tag: "all",
  status: "active",
  dateFrom: "",
  dateTo: "",
  dueSoon: false,
};

export default function App() {
  const [view, setView] = useState<View>("focus");
  const [facets, setFacets] = useState<FacetState>(DEFAULT_FACETS);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editing, setEditing] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [graphScope, setGraphScope] = useState<GraphScope>("neighborhood");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    kind: "success" | "error";
  } | null>(null);
  const [toastExiting, setToastExiting] = useState(false);
  const toastHideRef = useRef<number | null>(null);
  const toastExitRef = useRef<number | null>(null);
  const [subscriptionsAddOpen, setSubscriptionsAddOpen] = useState(false);
  const [subscriptionsFocusId, setSubscriptionsFocusId] = useState<
    string | null
  >(null);
  const [projectsAddOpen, setProjectsAddOpen] = useState(false);
  const [projectsFocusId, setProjectsFocusId] = useState<string | null>(null);
  const [meetingsComposeTemplateId, setMeetingsComposeTemplateId] = useState<
    string | null
  >(null);
  const [meetingsFocusId, setMeetingsFocusId] = useState<string | null>(null);
  const [focusStatsTick, setFocusStatsTick] = useState(0);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [linkedToSelection, setLinkedToSelection] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { displayView, visible: viewVisible } = useViewCrossfade(view);

  useCommandPaletteShortcut(() => setCommandPaletteOpen(true));

  const showToast = useCallback(
    (message: string, kind: "success" | "error") => {
      if (toastHideRef.current != null) {
        window.clearTimeout(toastHideRef.current);
        toastHideRef.current = null;
      }
      if (toastExitRef.current != null) {
        window.clearTimeout(toastExitRef.current);
        toastExitRef.current = null;
      }
      setToastExiting(false);
      setToast({ message, kind });
      toastHideRef.current = window.setTimeout(() => {
        setToastExiting(true);
        toastExitRef.current = window.setTimeout(() => {
          setToast(null);
          setToastExiting(false);
          toastExitRef.current = null;
        }, 230);
        toastHideRef.current = null;
      }, 3800);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (toastHideRef.current != null) window.clearTimeout(toastHideRef.current);
      if (toastExitRef.current != null) window.clearTimeout(toastExitRef.current);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchWithFacets({
        query: facets.query,
        type: facets.type,
        tag: facets.tag,
        status: facets.status,
        dateFrom: facets.dateFrom || undefined,
        dateTo: facets.dateTo || undefined,
        dueSoon: facets.dueSoon,
        linkedToId:
          linkedToSelection && selectedId ? selectedId : undefined,
      });
      setResults(data);
      if (selectedId) {
        const item = await getItemById(selectedId);
        setSelectedItem(item);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
  }, [facets, selectedId, linkedToSelection]);

  useEffect(() => {
    if (view === "inbox") void refresh();
  }, [refresh, view]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedItem(null);
      setEditing(false);
      return;
    }
    setGraphScope("neighborhood");
    void getItemById(selectedId).then(setSelectedItem);
  }, [selectedId]);

  function handleEditItem(id: string) {
    setSelectedId(id);
    setEditing(true);
  }

  function openInboxWithSelection(id: string) {
    setSelectedId(id);
    setEditing(false);
    setView("inbox");
  }

  function openInboxQuickCreate(type: ItemType) {
    setFacets((prev) => ({ ...prev, type, status: "active" }));
    setView("inbox");
  }

  const openSubscription = useCallback((id: string) => {
    setSubscriptionsFocusId(id);
    setView("subscriptions");
  }, []);

  useEffect(() => {
    void checkSubscriptionRenewalReminders();
    const dayMs = 24 * 60 * 60 * 1000;
    const interval = window.setInterval(() => {
      void checkSubscriptionRenewalReminders();
    }, dayMs);

    let unlistenFocus: (() => void) | undefined;
    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) void checkSubscriptionRenewalReminders();
      })
      .then((fn) => {
        unlistenFocus = fn;
      })
      .catch(() => undefined);

    let actionListener: Awaited<
      ReturnType<typeof registerRenewalNotificationActions>
    >;
    void registerRenewalNotificationActions(openSubscription).then((listener) => {
      actionListener = listener;
    });

    return () => {
      window.clearInterval(interval);
      unlistenFocus?.();
      void actionListener?.unregister();
    };
  }, [openSubscription]);

  useEffect(() => {
    const unlisten = listen("item:saved", () => {
      if (view === "inbox") void refresh();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refresh, view]);

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
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [view]);

  function patchFacets(patch: Partial<FacetState>) {
    setFacets((prev) => ({ ...prev, ...patch }));
  }

  async function handleMarkVisibleDone() {
    const activeIds = results
      .map((r) => r.item)
      .filter((i) => {
        const s = i.metadata.status as string | undefined;
        return !s || s === "active";
      })
      .map((i) => i.id);
    if (activeIds.length === 0) {
      showToast("No active items in this view.", "error");
      return;
    }
    const ok = window.confirm(
      `Mark ${activeIds.length} visible item(s) as done?`,
    );
    if (!ok) return;
    setBatchBusy(true);
    try {
      const count = await markItemsDone(activeIds);
      showToast(`Marked ${count} item(s) as done.`, "success");
      void refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Batch update failed",
        "error",
      );
    } finally {
      setBatchBusy(false);
    }
  }

  const quickCreateType: ItemType | null =
    facets.type === "note" ||
    facets.type === "meeting" ||
    facets.type === "task" ||
    facets.type === "subscription" ||
    facets.type === "project"
      ? facets.type
      : null;

  const defaultMeetingForTask =
    quickCreateType === "task" && selectedItem?.type === "meeting"
      ? selectedItem.id
      : null;

  return (
    <FocusTimerProvider onStatsChange={() => setFocusStatsTick((t) => t + 1)}>
    <div className="flex h-screen flex-col bg-pds-bg text-pds-text">
      <header className="flex items-center gap-3 border-b border-pds-border px-4 py-3">
        <div>
          <h1 className="pds-wordmark text-pds-base text-pds-text">
            DonePath
          </h1>
          <p className="text-pds-caption text-pds-muted">
            Local-first tasks, meetings, and focus on your computer
          </p>
        </div>
        <ThemeToggle compact />
        <nav className="ml-auto flex gap-1">
          {(
            [
              ["focus", "Focus"],
              ["inbox", "Inbox"],
              ["subscriptions", "Subscriptions"],
              ["projects", "Projects"],
              ["meeting", "Meeting"],
              ["settings", "Settings"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-pds-sm ${
                view === id
                  ? "bg-pds-accent text-pds-accent-fg"
                  : "text-pds-muted hover:text-pds-text"
              }`}
            >
              <NavViewIcon view={id} />
              {label}
            </button>
          ))}
        </nav>
      </header>

      {toast && (
        <p
          role="status"
          className={`mx-4 mt-2 rounded px-3 py-2 text-pds-sm ${
            toastExiting ? "pds-toast-exit" : "pds-toast-enter"
          } ${
            toast.kind === "success"
              ? "bg-emerald-950/60 text-emerald-300"
              : "bg-red-950/60 text-red-300"
          }`}
        >
          {toast.message}
        </p>
      )}

      <div
        className={`pds-crossfade flex min-h-0 flex-1 flex-col ${
          viewVisible ? "pds-crossfade-visible" : "pds-crossfade-hidden"
        }`}
      >
      {displayView === "focus" && (
        <FocusView
          statsTick={focusStatsTick}
          onToast={showToast}
          onSelectItem={(id, kind) => {
            if (kind === "project") {
              setProjectsFocusId(id);
              setView("projects");
            } else if (kind === "subscription") {
              openSubscription(id);
            } else {
              openInboxWithSelection(id);
            }
          }}
          onOpenLinkedContext={(ctx) => {
            if (ctx.view === "projects") {
              setProjectsFocusId(ctx.id);
              setView("projects");
            } else {
              setMeetingsFocusId(ctx.id);
              setView("meeting");
            }
          }}
          onQuickCreate={(type) => {
            if (type === "subscription") {
              setSubscriptionsAddOpen(true);
              setView("subscriptions");
            } else if (type === "project") {
              setProjectsAddOpen(true);
              setView("projects");
            } else if (type === "note") {
              patchFacets({ type: "note" });
              setView("inbox");
            } else {
              openInboxQuickCreate(type);
            }
          }}
        />
      )}

      {displayView === "inbox" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <SearchFacetsBar
            facets={facets}
            onChange={patchFacets}
            searchRef={searchRef}
          />
          {quickCreateType && (
            <QuickCreateForm
              type={quickCreateType}
              defaultMeetingId={defaultMeetingForTask}
              onCreated={(item) => {
                setSelectedId(item.id);
                void refresh();
              }}
              onToast={showToast}
            />
          )}
          <div className="flex flex-wrap items-center gap-2 border-b border-pds-border px-4 py-2">
            <button
              type="button"
              onClick={() => setShowGraph((v) => !v)}
              className={`rounded px-2 py-0.5 text-pds-sm ${
                showGraph
                  ? "pds-chip-active"
                  : "bg-pds-chip text-pds-chip-fg"
              }`}
            >
              {showGraph ? "Hide graph" : "Show graph"}
            </button>
            <button
              type="button"
              disabled={!selectedId}
              onClick={() => setLinkedToSelection((v) => !v)}
              className={`rounded px-2 py-0.5 text-pds-sm disabled:opacity-40 ${
                linkedToSelection
                  ? "pds-chip-active"
                  : "bg-pds-chip text-pds-chip-fg"
              }`}
            >
              Linked to selection
            </button>
            <button
              type="button"
              disabled={batchBusy || results.length === 0}
              onClick={() => void handleMarkVisibleDone()}
              className="rounded px-2 py-0.5 text-pds-sm bg-pds-chip text-pds-chip-fg disabled:opacity-40"
            >
              Mark visible done
            </button>
            {selectedId && (
              <button
                type="button"
                onClick={() => {
                  setLinkedToSelection(false);
                  setSelectedId(null);
                }}
                className="rounded px-2 py-0.5 text-pds-sm bg-pds-chip text-pds-chip-fg"
              >
                Clear selection
              </button>
            )}
          </div>
          {showGraph && (
            <div className="border-b border-pds-border px-4 py-3">
              <Suspense
                fallback={
                  <p className="py-6 text-center text-pds-sm text-pds-muted">
                    Loading graph…
                  </p>
                }
              >
                <GraphView
                  focusId={selectedId}
                  scope={graphScope}
                  onScopeChange={setGraphScope}
                  onSelectItem={(id) => setSelectedId(id)}
                />
              </Suspense>
            </div>
          )}
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
                onToast={showToast}
                onEdit={handleEditItem}
                emptyMessage={
                  linkedToSelection && selectedId
                    ? "No items linked to the selection in this filter."
                    : undefined
                }
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
              onToast={showToast}
              onChanged={() => void refresh()}
              onNavigateToFocus={() => setView("focus")}
            />
          </div>
        </div>
      )}

      {displayView === "subscriptions" && (
        <Suspense fallback={<DeferredRouteFallback />}>
          <SubscriptionsView
            onToast={showToast}
            initialShowAdd={subscriptionsAddOpen}
            onInitialShowAddConsumed={() => setSubscriptionsAddOpen(false)}
            initialSelectedId={subscriptionsFocusId}
            onInitialSelectedConsumed={() => setSubscriptionsFocusId(null)}
          />
        </Suspense>
      )}

      {displayView === "projects" && (
        <Suspense fallback={<DeferredRouteFallback />}>
          <ProjectsView
            onToast={showToast}
            onNavigateToFocus={() => setView("focus")}
            onNavigateToLinkedItem={(item) => {
              if (item.type === "subscription") {
                setSubscriptionsFocusId(item.id);
                setView("subscriptions");
              } else {
                openInboxWithSelection(item.id);
              }
            }}
            initialShowAdd={projectsAddOpen}
            onInitialShowAddConsumed={() => setProjectsAddOpen(false)}
            initialSelectedId={projectsFocusId}
            onInitialSelectedConsumed={() => setProjectsFocusId(null)}
          />
        </Suspense>
      )}

      {displayView === "meeting" && (
        <main className="flex min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={<DeferredRouteFallback />}>
            <MeetingsView
              onToast={showToast}
              onNavigateToFocus={() => setView("focus")}
              initialComposeTemplateId={meetingsComposeTemplateId}
              onInitialComposeTemplateConsumed={() =>
                setMeetingsComposeTemplateId(null)
              }
              initialSelectedId={meetingsFocusId}
              onInitialSelectedConsumed={() => setMeetingsFocusId(null)}
            />
          </Suspense>
        </main>
      )}

      {displayView === "settings" && (
        <main className="min-h-0 flex-1 overflow-auto">
          <Suspense fallback={<DeferredRouteFallback />}>
            <SettingsPanel
              onClose={() => setView("focus")}
              onToast={showToast}
            />
          </Suspense>
        </main>
      )}
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        actions={{
          setView,
          openInboxQuickCreate,
          openInboxWithSelection,
          focusProject: (projectId) => {
            setProjectsFocusId(projectId);
            setView("projects");
          },
          composeMeetingFromTemplate: (templateId) => {
            setMeetingsComposeTemplateId(templateId);
            setView("meeting");
          },
          onToast: showToast,
        }}
      />
    </div>
    </FocusTimerProvider>
  );
}
