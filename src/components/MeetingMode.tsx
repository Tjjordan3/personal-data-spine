import { useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { saveMeetingWithTasks } from "../lib/db/items";
import { parseMeetingNotes } from "../lib/meeting/heuristicParser";
import {
  loadLlmSettings,
  refineMeetingNotes,
  type LlmSettings,
} from "../lib/meeting/llmRefiner";
import type { ParsedAction } from "../lib/meeting/types";

interface MeetingModeProps {
  onSaved: (meetingId: string) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export function MeetingMode({
  onSaved,
  onError,
  onSuccess,
}: MeetingModeProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [actions, setActions] = useState<ParsedAction[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [llmSettings] = useState<LlmSettings>(() => loadLlmSettings());

  async function handleParse() {
    if (!notes.trim()) return;
    setParsing(true);
    try {
      const parsed = parseMeetingNotes(notes);
      setActions(parsed);
      if (parsed.length === 0) {
        onError("No action items detected. Try bullet lines or TODO:/ACTION: prefixes.");
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
    if (actions.length === 0) {
      onError("Parse meeting notes before saving.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveMeetingWithTasks(
        notes,
        actions.map((a) => ({
          content: a.text,
          owner: a.owner,
          due_date: a.due_date,
        })),
        { title: title.trim() || null },
      );
      await emit("item:saved", {});
      onSuccess(
        `Saved “${title.trim() || "meeting"}” with ${result.tasks.length} task(s).`,
      );
      setTitle("");
      setNotes("");
      setActions([]);
      onSaved(result.meeting.id);
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
      },
    ]);
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
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
        placeholder="Paste meeting notes… Use bullets, TODO:, or ACTION: lines."
        className="min-h-[180px] flex-1 resize-none rounded-lg border border-pds-border bg-pds-panel px-3 py-2 text-sm text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
      />

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
          disabled={saving || actions.length === 0}
          className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save meeting + tasks"}
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
