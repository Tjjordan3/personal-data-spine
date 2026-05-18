import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { emit } from "@tauri-apps/api/event";
import { getItemById, insertItem } from "../lib/db/items";
import type { ItemStatus } from "../lib/db/itemStatus";
import {
  getTasksForProject,
  listProjects,
  PROJECT_AREA_PRESETS,
  PROJECT_PRIORITY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
} from "../lib/db/projects";
import type { Item, ProjectPriority, ProjectStatus } from "../lib/db/types";
import type { SearchResult } from "../lib/db/search";
import { detectTags } from "../lib/tags/keywordTagger";
import { ItemList } from "./ItemList";
import { RelatedPanel } from "./RelatedPanel";

interface ProjectsViewProps {
  onToast: (message: string, kind: "success" | "error") => void;
  initialShowAdd?: boolean;
  onInitialShowAddConsumed?: () => void;
  initialSelectedId?: string | null;
  onInitialSelectedConsumed?: () => void;
}

function AddProjectForm({
  onClose,
  onCreated,
  onToast,
}: {
  onClose: () => void;
  onCreated: (item: Item) => void;
  onToast: (message: string, kind: "success" | "error") => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [area, setArea] = useState("");
  const [priority, setPriority] = useState<ProjectPriority | "">("");
  const [targetDate, setTargetDate] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      onToast("Project name is required.", "error");
      return;
    }
    setSaving(true);
    try {
      const tags = [
        ...new Set(["#project", ...detectTags(trimmed + " " + notes)]),
      ].slice(0, 8);
      const saved = await insertItem({
        type: "project",
        content: trimmed,
        tags,
        source: "projects-tab",
        metadata: {
          status,
          notes: notes.trim() || null,
          area: area.trim() || null,
          priority: priority || null,
          target_date: targetDate.trim() || null,
          started_at: startedAt.trim() || null,
        },
      });
      await emit("item:saved", {});
      onCreated(saved);
      onToast("Project created.", "success");
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Failed to create project",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="border-b border-pds-border bg-pds-panel-2/40 px-4 py-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-pds-muted">New project</p>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-pds-muted hover:text-pds-text"
        >
          Close
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-[11px] text-pds-muted sm:col-span-2">
          Title
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            placeholder="Project name…"
            className="mt-1 w-full rounded border border-pds-border bg-pds-panel px-3 py-2 text-sm text-pds-text focus:border-pds-muted focus:outline-none"
          />
        </label>
        <label className="block text-[11px] text-pds-muted sm:col-span-2">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            disabled={saving}
            placeholder="Goals, scope, links…"
            className="mt-1 w-full resize-y rounded border border-pds-border bg-pds-panel px-3 py-2 text-sm text-pds-text focus:border-pds-muted focus:outline-none"
          />
        </label>
        <label className="block text-[11px] text-pds-muted">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            disabled={saving}
            className="mt-1 w-full rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-sm text-pds-text"
          >
            {PROJECT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] text-pds-muted">
          Priority
          <select
            value={priority}
            onChange={(e) =>
              setPriority((e.target.value as ProjectPriority) || "")
            }
            disabled={saving}
            className="mt-1 w-full rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-sm text-pds-text"
          >
            <option value="">None</option>
            {PROJECT_PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] text-pds-muted">
          Area
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            list="project-area-presets"
            disabled={saving}
            placeholder="work, home…"
            className="mt-1 w-full rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-sm text-pds-text"
          />
          <datalist id="project-area-presets">
            {PROJECT_AREA_PRESETS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <label className="block text-[11px] text-pds-muted">
          Target date
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            disabled={saving}
            className="mt-1 w-full rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-sm text-pds-text"
          />
        </label>
        <label className="block text-[11px] text-pds-muted">
          Started
          <input
            type="date"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            disabled={saving}
            className="mt-1 w-full rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-sm text-pds-text"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="mt-3 rounded bg-emerald-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
      >
        {saving ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}

export function ProjectsView({
  onToast,
  initialShowAdd = false,
  onInitialShowAddConsumed,
  initialSelectedId = null,
  onInitialSelectedConsumed,
}: ProjectsViewProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [linkedTasks, setLinkedTasks] = useState<Item[]>([]);
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
      onInitialSelectedConsumed?.();
    }
  }, [initialSelectedId, onInitialSelectedConsumed]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listProjects({ status, limit: 500 });
      setItems(rows);
      if (selectedId) {
        const item = await getItemById(selectedId);
        setSelectedItem(item);
        if (item?.type === "project") {
          setLinkedTasks(await getTasksForProject(item.id));
        } else {
          setLinkedTasks([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
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
      setLinkedTasks([]);
      setEditing(false);
      return;
    }
    void getItemById(selectedId).then(async (item) => {
      setSelectedItem(item);
      if (item?.type === "project") {
        setLinkedTasks(await getTasksForProject(item.id));
      } else {
        setLinkedTasks([]);
      }
    });
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
        const meta = item.metadata;
        const haystack = [
          item.content,
          meta.notes,
          meta.area,
          meta.status,
          meta.priority,
          meta.target_date,
          item.tags.join(" "),
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
          <h2 className="text-sm font-semibold text-pds-text">Projects</h2>
          <p className="text-[11px] text-pds-muted">
            Track initiatives, targets, and linked tasks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            showAdd
              ? "border border-pds-border text-pds-muted"
              : "bg-emerald-600 text-white"
          }`}
        >
          {showAdd ? "Close form" : "New project"}
        </button>
      </div>

      {showAdd && (
        <AddProjectForm
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
          placeholder="Search projects…"
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
            loadProjectRollups
            emptyMessage="No projects yet. Create one to track goals and linked tasks."
          />
        </main>
        <div className="flex min-h-0 shrink-0">
          {selectedItem?.type === "project" && linkedTasks.length > 0 && (
            <aside className="flex w-48 shrink-0 flex-col border-l border-pds-border">
              <div className="border-b border-pds-border p-3">
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-pds-muted">
                  Linked tasks
                </h3>
                <p className="mt-0.5 text-[10px] text-pds-subtle">
                  {linkedTasks.length} task
                  {linkedTasks.length === 1 ? "" : "s"}
                </p>
              </div>
              <ul className="min-h-0 flex-1 overflow-auto p-2">
                {linkedTasks.map((task) => (
                  <li key={task.id} className="mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setSelectedId(task.id);
                      }}
                      className="w-full rounded border border-pds-border bg-pds-panel/50 px-2 py-1.5 text-left text-[11px] text-pds-text hover:border-pds-muted"
                    >
                      {task.content.slice(0, 80)}
                      {task.content.length > 80 ? "…" : ""}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          )}
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
    </div>
  );
}
