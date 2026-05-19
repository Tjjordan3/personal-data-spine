import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { insertItem } from "../lib/db/items";
import {
  PROJECT_AREA_PRESETS,
  PROJECT_PRIORITY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
} from "../lib/db/projects";
import { PROJECT_TEMPLATES } from "../lib/projects/templates";
import type { Item, ProjectPriority, ProjectStatus } from "../lib/db/types";
import { detectTags } from "../lib/tags/keywordTagger";

interface ProjectComposeModeProps {
  onSaved: (item: Item) => void;
  onToast: (message: string, kind: "success" | "error") => void;
}

function isTextareaTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return target.tagName === "TEXTAREA";
}

export function ProjectComposeMode({
  onSaved,
  onToast,
}: ProjectComposeModeProps) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [area, setArea] = useState("");
  const [priority, setPriority] = useState<ProjectPriority | "">("");
  const [targetDate, setTargetDate] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        if (isTextareaTarget(event.target)) return;
        event.preventDefault();
        void handleSave();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  function applyTemplate(templateId: string) {
    const template = PROJECT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setNotes(template.body);
  }

  async function handleSave() {
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
          started_at: null,
        },
      });
      await emit("item:saved", {});
      onToast("Project created.", "success");
      setName("");
      setNotes("");
      setArea("");
      setPriority("");
      setTargetDate("");
      setStatus("active");
      onSaved(saved);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Failed to create project",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  const canSave = name.trim().length > 0 && !saving;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-pds-caption text-pds-muted">Template:</span>
        {PROJECT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => applyTemplate(t.id)}
            className="rounded border border-pds-border px-2 py-0.5 text-pds-caption text-pds-muted hover:bg-pds-chip"
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-pds-caption text-pds-subtle">
          Ctrl+S save
        </span>
      </div>

      <label className="block text-pds-sm text-pds-muted">
        Project name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          placeholder="e.g. Q3 platform migration"
          className="mt-1 w-full rounded-lg border border-pds-border bg-pds-panel px-3 py-2 text-pds-base text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
        />
      </label>

      <label className="flex min-h-0 flex-1 flex-col text-pds-sm text-pds-muted">
        Goals & notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={saving}
          placeholder="Goals, outcomes, scope…"
          className="mt-1 min-h-[200px] flex-1 resize-y rounded-lg border border-pds-border bg-pds-panel px-3 py-2 text-pds-base text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
        />
      </label>

      <div>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="text-pds-caption text-pds-muted hover:text-pds-text"
        >
          {showDetails ? "Hide details" : "Show details (status, area, dates)"}
        </button>
        {showDetails && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block text-pds-sm text-pds-muted">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                disabled={saving}
                className="mt-1 w-full rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-pds-base text-pds-text"
              >
                {PROJECT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-pds-sm text-pds-muted">
              Priority
              <select
                value={priority}
                onChange={(e) =>
                  setPriority((e.target.value as ProjectPriority) || "")
                }
                disabled={saving}
                className="mt-1 w-full rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-pds-base text-pds-text"
              >
                <option value="">None</option>
                {PROJECT_PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-pds-sm text-pds-muted">
              Area
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                list="project-area-presets-compose-mode"
                disabled={saving}
                placeholder="work, home…"
                className="mt-1 w-full rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-pds-base text-pds-text"
              />
              <datalist id="project-area-presets-compose-mode">
                {PROJECT_AREA_PRESETS.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </label>
            <label className="block text-pds-sm text-pds-muted">
              Target date
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                disabled={saving}
                className="mt-1 w-full rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-pds-base text-pds-text"
              />
            </label>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={!canSave}
        className="w-fit pds-btn-primary px-4 py-2 text-pds-sm font-medium"
      >
        {saving ? "Creating…" : "Create project"}
      </button>
    </div>
  );
}
