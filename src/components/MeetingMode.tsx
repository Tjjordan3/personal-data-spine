import { useState } from "react";
import { saveMeetingWithTasks } from "../lib/db/items";
import { parseMeetingNotes } from "../lib/meeting/heuristicParser";
import {
  loadLlmSettings,
  refineMeetingNotes,
  type LlmSettings,
} from "../lib/meeting/llmRefiner";
import type { ParsedAction } from "../lib/meeting/types";

interface MeetingModeProps {
  onSaved: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export function MeetingMode({
  onSaved,
  onError,
  onSuccess,
}: MeetingModeProps) {
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
      );
      onSuccess(
        `Saved meeting and ${result.tasks.length} task(s).`,
      );
      setNotes("");
      setActions([]);
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save meeting");
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
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Paste meeting notes… Use bullets, TODO:, or ACTION: lines."
        className="min-h-[180px] flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleParse()}
          disabled={parsing || !notes.trim()}
          className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-40"
        >
          {parsing ? "Parsing…" : "Parse preview"}
        </button>
        <button
          type="button"
          onClick={() => void handleRefine()}
          disabled={parsing || !notes.trim() || !llmSettings.enabled}
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 disabled:opacity-40"
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
          className="rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
        >
          Add row
        </button>
      </div>

      {actions.length > 0 && (
        <div className="overflow-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900 text-zinc-500">
              <tr>
                <th className="px-2 py-2 font-medium">Action</th>
                <th className="w-28 px-2 py-2 font-medium">Owner</th>
                <th className="w-32 px-2 py-2 font-medium">Due</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {actions.map((row) => (
                <tr key={row.id} className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5">
                    <input
                      value={row.text}
                      onChange={(e) =>
                        updateAction(row.id, { text: e.target.value })
                      }
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-100"
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
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-100"
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
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-100"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeAction(row.id)}
                      className="text-zinc-500 hover:text-red-400"
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
