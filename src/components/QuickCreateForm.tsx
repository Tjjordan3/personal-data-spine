import { useCallback, useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { insertItem, listItems } from "../lib/db/items";
import { listActiveProjectsForPicker } from "../lib/db/projects";
import { detectTags } from "../lib/tags/keywordTagger";
import type { Item, ItemType, ProjectPriority } from "../lib/db/types";

export type QuickCreateItemType = Exclude<ItemType, "work_block">;

interface QuickCreateFormProps {
  type: QuickCreateItemType;
  defaultMeetingId?: string | null;
  onCreated: (item: Item) => void;
  onToast: (message: string, kind: "success" | "error") => void;
}

const TYPE_LABELS: Record<QuickCreateItemType, string> = {
  note: "note",
  meeting: "meeting",
  task: "task",
  subscription: "subscription",
  project: "project",
};

const DEFAULT_TAGS: Record<QuickCreateItemType, string[]> = {
  note: [],
  meeting: ["#meeting"],
  task: ["#task"],
  subscription: ["#subscription"],
  project: ["#project"],
};

export function QuickCreateForm({
  type,
  defaultMeetingId,
  onCreated,
  onToast,
}: QuickCreateFormProps) {
  const [content, setContent] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState("");
  const [subscriptionNotes, setSubscriptionNotes] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
  const [projectArea, setProjectArea] = useState("");
  const [projectPriority, setProjectPriority] = useState<ProjectPriority | "">(
    "",
  );
  const [projectTargetDate, setProjectTargetDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [meetingId, setMeetingId] = useState(defaultMeetingId ?? "");
  const [meetings, setMeetings] = useState<Item[]>([]);
  const [projects, setProjects] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);

  const loadMeetings = useCallback(async () => {
    if (type !== "task") return;
    const rows = await listItems({ type: "meeting", status: "all", limit: 50 });
    setMeetings(rows);
    setProjects(await listActiveProjectsForPicker());
  }, [type]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    setMeetingId(defaultMeetingId ?? "");
  }, [defaultMeetingId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) {
      onToast("Enter some content first.", "error");
      return;
    }

    setSaving(true);
    try {
      const tags = [
        ...new Set([...DEFAULT_TAGS[type], ...detectTags(text)]),
      ].slice(0, 8);

      if (type === "task") {
        const linkedMeeting = meetingId.trim() || null;
        const saved = await insertItem({
          type: "task",
          content: text,
          tags,
          source: "quick-create",
          metadata: {
            meeting_id: linkedMeeting,
            owner: owner.trim() || null,
            due_date: dueDate.trim() || null,
            project_id: projectId.trim() || null,
          },
        });
        await emit("item:saved", {});
        onCreated(saved);
        onToast("Task created.", "success");
      } else if (type === "meeting") {
        const saved = await insertItem({
          type: "meeting",
          content: text,
          tags,
          source: "quick-create",
          metadata: { parsed_at: new Date().toISOString(), task_count: 0 },
        });
        await emit("item:saved", {});
        onCreated(saved);
        onToast("Meeting created.", "success");
      } else if (type === "subscription") {
        const saved = await insertItem({
          type: "subscription",
          content: text,
          tags,
          source: "quick-create",
          metadata: {
            renewal_date: renewalDate.trim() || null,
            amount: amount.trim() || null,
            cadence: cadence.trim() || null,
            status: "active",
            notes: subscriptionNotes.trim() || null,
          },
        });
        await emit("item:saved", {});
        onCreated(saved);
        onToast("Subscription created.", "success");
      } else if (type === "project") {
        const saved = await insertItem({
          type: "project",
          content: text,
          tags,
          source: "quick-create",
          metadata: {
            status: "active",
            notes: projectNotes.trim() || null,
            area: projectArea.trim() || null,
            priority: projectPriority || null,
            target_date: projectTargetDate.trim() || null,
          },
        });
        await emit("item:saved", {});
        onCreated(saved);
        onToast("Project created.", "success");
      } else {
        const saved = await insertItem({
          type: "note",
          content: text,
          tags,
          source: "quick-create",
          metadata: {},
        });
        await emit("item:saved", {});
        onCreated(saved);
        onToast("Note created.", "success");
      }

      setContent("");
      setOwner("");
      setDueDate("");
      setRenewalDate("");
      setAmount("");
      setCadence("");
      setSubscriptionNotes("");
      setProjectNotes("");
      setProjectArea("");
      setProjectPriority("");
      setProjectTargetDate("");
      setProjectId("");
      if (!defaultMeetingId) setMeetingId("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      onToast(message || "Failed to create item", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="border-b border-pds-border bg-pds-panel-2/40 px-4 py-3"
    >
      <p className="mb-2 text-[11px] font-medium text-pds-muted">
        New {TYPE_LABELS[type]}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            type === "meeting"
              ? "Meeting title or summary…"
              : type === "task"
                ? "What needs to be done?"
                : type === "subscription"
                  ? "Subscription name…"
                  : type === "project"
                    ? "Project name…"
                    : "Quick note…"
          }
          disabled={saving}
          className="min-w-0 flex-1 rounded border border-pds-border bg-pds-panel px-3 py-2 text-sm text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
        />
        {type === "task" && (
          <>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Owner"
              disabled={saving}
              className="w-full rounded border border-pds-border bg-pds-panel px-2 py-2 text-sm text-pds-text sm:w-28"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={saving}
              className="w-full rounded border border-pds-border bg-pds-panel px-2 py-2 text-sm text-pds-text sm:w-36"
            />
          </>
        )}
        {type === "subscription" && (
          <>
            <input
              type="date"
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
              disabled={saving}
              className="w-full rounded border border-pds-border bg-pds-panel px-2 py-2 text-sm text-pds-text sm:w-36"
              title="Renewal date"
            />
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              disabled={saving}
              className="w-full rounded border border-pds-border bg-pds-panel px-2 py-2 text-sm text-pds-text sm:w-24"
            />
            <input
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              placeholder="Monthly"
              disabled={saving}
              className="w-full rounded border border-pds-border bg-pds-panel px-2 py-2 text-sm text-pds-text sm:w-28"
            />
          </>
        )}
        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="pds-btn-primary shrink-0 px-4 py-2 text-xs"
        >
          {saving ? "Saving…" : "Add"}
        </button>
      </div>
      {type === "task" && meetings.length > 0 && (
        <label className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-pds-muted">
          Link to meeting
          <select
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
            disabled={saving}
            className="min-w-0 flex-1 rounded border border-pds-border bg-pds-panel px-2 py-1 text-pds-text sm:max-w-md"
          >
            <option value="">None</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.content.slice(0, 60).replace(/\s+/g, " ")}
                {m.content.length > 60 ? "…" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {type === "subscription" && (
        <input
          value={subscriptionNotes}
          onChange={(e) => setSubscriptionNotes(e.target.value)}
          placeholder="Notes (optional)…"
          disabled={saving}
          className="mt-2 w-full rounded border border-pds-border bg-pds-panel px-3 py-2 text-sm text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
        />
      )}
      {type === "project" && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <input
            value={projectNotes}
            onChange={(e) => setProjectNotes(e.target.value)}
            placeholder="Notes (optional)…"
            disabled={saving}
            className="min-w-0 flex-1 rounded border border-pds-border bg-pds-panel px-3 py-2 text-sm text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
          />
          <input
            value={projectArea}
            onChange={(e) => setProjectArea(e.target.value)}
            placeholder="Area"
            disabled={saving}
            className="w-full rounded border border-pds-border bg-pds-panel px-2 py-2 text-sm text-pds-text sm:w-28"
          />
          <select
            value={projectPriority}
            onChange={(e) =>
              setProjectPriority((e.target.value as ProjectPriority) || "")
            }
            disabled={saving}
            className="w-full rounded border border-pds-border bg-pds-panel px-2 py-2 text-sm text-pds-text sm:w-28"
          >
            <option value="">Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input
            type="date"
            value={projectTargetDate}
            onChange={(e) => setProjectTargetDate(e.target.value)}
            disabled={saving}
            className="w-full rounded border border-pds-border bg-pds-panel px-2 py-2 text-sm text-pds-text sm:w-36"
            title="Target date"
          />
        </div>
      )}
      {type === "task" && projects.length > 0 && (
        <label className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-pds-muted">
          Project
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={saving}
            className="min-w-0 flex-1 rounded border border-pds-border bg-pds-panel px-2 py-1 text-pds-text sm:max-w-md"
          >
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.content.slice(0, 60).replace(/\s+/g, " ")}
                {p.content.length > 60 ? "…" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {type === "meeting" && (
        <p className="mt-1.5 text-[10px] text-pds-subtle">
          For bulk action items from notes, use the Meeting tab.
        </p>
      )}
    </form>
  );
}
