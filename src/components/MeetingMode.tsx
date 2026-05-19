import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { saveMeetingWithTasks } from "../lib/db/items";
import { listActiveProjectsForPicker } from "../lib/db/projects";
import { parseMeetingNotes } from "../lib/meeting/heuristicParser";
import { MEETING_TEMPLATES } from "../lib/meeting/templates";
import {
  loadUserMeetingTemplates,
  meetingBodyAsTemplate,
  saveUserMeetingTemplate,
} from "../lib/meeting/userTemplates";
import {
  loadLlmSettings,
  refineMeetingNotes,
  type LlmSettings,
} from "../lib/meeting/llmRefiner";
import type { ParsedAction } from "../lib/meeting/types";
import type { Item } from "../lib/db/types";

export interface MeetingSaveResult {
  meetingId: string;
  tasks: Item[];
}

interface MeetingModeProps {
  onSaved: (result: MeetingSaveResult) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  initialTemplateId?: string | null;
  /** Prefill compose from a prior meeting (duplicate structure). */
  duplicateFrom?: { content: string; title?: string | null } | null;
}

function isTextareaTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return target.tagName === "TEXTAREA";
}

export function MeetingMode({
  onSaved,
  onError,
  onSuccess,
  initialTemplateId = null,
  duplicateFrom = null,
}: MeetingModeProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [actions, setActions] = useState<ParsedAction[]>([]);
  const [decisions, setDecisions] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [llmSettings] = useState<LlmSettings>(() => loadLlmSettings());
  const [projects, setProjects] = useState<Item[]>([]);
  const [userTemplates, setUserTemplates] = useState(() =>
    loadUserMeetingTemplates(),
  );

  useEffect(() => {
    void listActiveProjectsForPicker().then(setProjects);
    setUserTemplates(loadUserMeetingTemplates());
  }, []);

  useEffect(() => {
    if (!initialTemplateId) return;
    const template = MEETING_TEMPLATES.find((t) => t.id === initialTemplateId);
    if (!template) return;
    setNotes(template.body);
    setActions([]);
    setDecisions([]);
  }, [initialTemplateId]);

  useEffect(() => {
    if (!duplicateFrom?.content) return;
    setNotes(duplicateFrom.content);
    setTitle(duplicateFrom.title?.trim() ?? "");
    setActions([]);
    setDecisions([]);
  }, [duplicateFrom]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void handleParse();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        if (isTextareaTarget(event.target)) return;
        event.preventDefault();
        void handleSave();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  async function handleParse() {
    if (!notes.trim()) return;
    setParsing(true);
    try {
      const parsed = parseMeetingNotes(notes);
      setActions(parsed.actions);
      setDecisions(parsed.decisions);
      if (parsed.actions.length === 0 && parsed.decisions.length === 0) {
        onError(
          "No actions or decisions detected. Use bullets, TODO:, or DECISION: lines.",
        );
      } else if (parsed.decisions.length > 0 && parsed.actions.length === 0) {
        onSuccess(
          `Found ${parsed.decisions.length} decision(s). You can save notes only.`,
        );
      }
    } finally {
      setParsing(false);
    }
  }

  async function handleRefine() {
    if (!notes.trim()) return;
    if (!llmSettings.enabled) {
      onError("Enable LLM refinement in Settings first.");
      return;
    }
    setParsing(true);
    try {
      const refined = await refineMeetingNotes(notes, llmSettings);
      setActions(refined);
      setDecisions(parseMeetingNotes(notes).decisions);
      if (refined.length === 0) {
        onError("LLM returned no actions. Falling back may be needed.");
      } else {
        onSuccess(`Refined ${refined.length} action item(s).`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "LLM refinement failed");
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    if (!notes.trim()) return;
    setSaving(true);
    try {
      const result = await saveMeetingWithTasks(
        notes,
        actions.map((a) => ({
          content: a.text,
          owner: a.owner,
          due_date: a.due_date,
          project_id: a.project_id,
        })),
        { title: title.trim() || null, decisions },
      );
      await emit("item:saved", {});
      const taskPart =
        result.tasks.length > 0
          ? ` with ${result.tasks.length} task(s)`
          : " (notes only)";
      onSuccess(`Saved “${title.trim() || "meeting"}”${taskPart}.`);
      setTitle("");
      setNotes("");
      setActions([]);
      setDecisions([]);
      onSaved({ meetingId: result.meeting.id, tasks: result.tasks });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err);
      onError(message || "Failed to save meeting");
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate(templateId: string) {
    const template =
      MEETING_TEMPLATES.find((t) => t.id === templateId) ??
      userTemplates.find((t) => t.id === templateId);
    if (!template) return;
    setNotes(template.body);
    setActions([]);
    setDecisions([]);
  }

  function saveNotesAsTemplate() {
    if (!notes.trim()) {
      onError("Add meeting notes before saving a template.");
      return;
    }
    const template = meetingBodyAsTemplate(notes, title);
    saveUserMeetingTemplate(template);
    setUserTemplates(loadUserMeetingTemplates());
    onSuccess(`Saved template “${template.label}”.`);
  }

  function updateAction(id: string, patch: Partial<ParsedAction>) {
    setActions((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removeAction(id: string) {
    setActions((prev) => prev.filter((row) => row.id !== id));
  }

  function addAction() {
    setActions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: "",
        owner: null,
        due_date: null,
        project_id: null,
      },
    ]);
  }

  const canSave = notes.trim().length > 0 && !saving;

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-pds-muted">Template:</span>
        {MEETING_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => applyTemplate(t.id)}
            className="rounded border border-pds-border px-2 py-0.5 text-[10px] text-pds-muted hover:bg-pds-chip"
          >
            {t.label}
          </button>
        ))}
        {userTemplates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => applyTemplate(t.id)}
            className="rounded border border-emerald-800/50 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300 hover:bg-pds-chip"
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={saveNotesAsTemplate}
          disabled={!notes.trim()}
          className="rounded border border-pds-border px-2 py-0.5 text-[10px] text-pds-muted hover:bg-pds-chip disabled:opacity-40"
        >
          Save as template
        </button>
        <span className="ml-auto text-[10px] text-pds-subtle">
          Ctrl+Enter parse · Ctrl+S save
        </span>
      </div>
      <label className="block text-[11px] text-pds-muted">
        Title (optional)
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Product sync — May 18"
          className="mt-1 w-full rounded-lg border border-pds-border bg-pds-panel px-3 py-2 text-sm text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
        />
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Paste meeting notes… Use bullets, TODO:, DECISION:, or ACTION: lines."
        className="min-h-[180px] flex-1 resize-none rounded-lg border border-pds-border bg-pds-panel px-3 py-2 text-sm text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
      />

      {decisions.length > 0 && (
        <div className="rounded-lg border border-pds-border bg-pds-panel/50 px-3 py-2">
          <p className="text-[10px] font-medium uppercase text-pds-muted">
            Decisions ({decisions.length})
          </p>
          <ul className="mt-1 list-inside list-disc text-[11px] text-pds-text">
            {decisions.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleParse()}
          disabled={parsing || !notes.trim()}
          className="rounded bg-pds-accent px-3 py-1.5 text-xs font-medium text-pds-accent-fg disabled:opacity-40"
        >
          {parsing ? "Parsing…" : "Parse preview"}
        </button>
        <button
          type="button"
          onClick={() => void handleRefine()}
          disabled={parsing || !notes.trim() || !llmSettings.enabled}
          className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-text disabled:opacity-40"
          title={
            llmSettings.enabled
              ? "Refine with LLM"
              : "Enable LLM in Settings"
          }
        >
          Refine with LLM
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className="pds-btn-primary px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save meeting"}
        </button>
        <button
          type="button"
          onClick={addAction}
          className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-muted"
        >
          Add row
        </button>
      </div>

      {actions.length > 0 && (
        <div className="overflow-auto rounded-lg border border-pds-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-pds-panel text-pds-muted">
              <tr>
                <th className="px-2 py-2 font-medium">Action</th>
                <th className="w-28 px-2 py-2 font-medium">Owner</th>
                <th className="w-32 px-2 py-2 font-medium">Due</th>
                <th className="w-36 px-2 py-2 font-medium">Project</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {actions.map((row) => (
                <tr key={row.id} className="border-t border-pds-border/80">
                  <td className="px-2 py-1.5">
                    <input
                      value={row.text}
                      onChange={(e) =>
                        updateAction(row.id, { text: e.target.value })
                      }
                      className="w-full rounded border border-pds-border bg-pds-input px-2 py-1 text-pds-text"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={row.owner ?? ""}
                      onChange={(e) =>
                        updateAction(row.id, {
                          owner: e.target.value || null,
                        })
                      }
                      className="w-full rounded border border-pds-border bg-pds-input px-2 py-1 text-pds-text"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={row.due_date ?? ""}
                      onChange={(e) =>
                        updateAction(row.id, {
                          due_date: e.target.value || null,
                        })
                      }
                      className="w-full rounded border border-pds-border bg-pds-input px-2 py-1 text-pds-text"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={row.project_id ?? ""}
                      onChange={(e) =>
                        updateAction(row.id, {
                          project_id: e.target.value || null,
                        })
                      }
                      className="w-full rounded border border-pds-border bg-pds-input px-1 py-1 text-pds-text"
                    >
                      <option value="">—</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.content.slice(0, 40)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeAction(row.id)}
                      className="text-pds-muted hover:text-red-400"
                      aria-label="Remove row"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

