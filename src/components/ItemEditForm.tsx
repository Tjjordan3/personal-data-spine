import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { duplicateItem, listItems, updateItem } from "../lib/db/items";
import {
  parseRecurrence,
  RECURRENCE_INTERVAL_OPTIONS,
  recurrenceToMetadata,
  type RecurrenceInterval,
} from "../lib/recurrence";
import {
  listActiveProjectsForPicker,
  PROJECT_AREA_PRESETS,
  PROJECT_PRIORITY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
} from "../lib/db/projects";
import { detectTags } from "../lib/tags/keywordTagger";
import type { Item, ProjectPriority, ProjectStatus } from "../lib/db/types";
import { TagAddField } from "./TagAddField";
import { TaskFocusStartButton } from "./TaskFocusStartButton";

interface ItemEditFormProps {
  item: Item;
  onSaved: (item: Item) => void;
  onCancel: () => void;
  onToast: (message: string, kind: "success" | "error") => void;
  onNavigateToFocus?: () => void;
  onDuplicated?: (item: Item) => void;
}

function mergeTagsForSave(tags: string[], content: string): string[] {
  return [...new Set([...tags, ...detectTags(content)])].slice(0, 8);
}

export function ItemEditForm({
  item,
  onSaved,
  onCancel,
  onToast,
  onNavigateToFocus,
  onDuplicated,
}: ItemEditFormProps) {
  const [content, setContent] = useState(item.content);
  const [meetingTitle, setMeetingTitle] = useState(
    (item.metadata.title as string | undefined) ?? "",
  );
  const [tags, setTags] = useState<string[]>(item.tags);
  const [owner, setOwner] = useState(
    (item.metadata.owner as string | undefined) ?? "",
  );
  const [dueDate, setDueDate] = useState(
    (item.metadata.due_date as string | undefined) ?? "",
  );
  const [meetingId, setMeetingId] = useState(
    (item.metadata.meeting_id as string | undefined) ?? "",
  );
  const [renewalDate, setRenewalDate] = useState(
    (item.metadata.renewal_date as string | undefined) ?? "",
  );
  const [amount, setAmount] = useState(
    String(item.metadata.amount ?? ""),
  );
  const [cadence, setCadence] = useState(
    (item.metadata.cadence as string | undefined) ?? "",
  );
  const [subscriptionNotes, setSubscriptionNotes] = useState(
    (item.metadata.notes as string | undefined) ?? "",
  );
  const [projectNotes, setProjectNotes] = useState(
    (item.metadata.notes as string | undefined) ?? "",
  );
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>(
    ((item.metadata.status as ProjectStatus | undefined) ?? "active") as ProjectStatus,
  );
  const [projectPriority, setProjectPriority] = useState<ProjectPriority | "">(
    (item.metadata.priority as ProjectPriority | undefined) ?? "",
  );
  const [projectArea, setProjectArea] = useState(
    (item.metadata.area as string | undefined) ?? "",
  );
  const [projectTargetDate, setProjectTargetDate] = useState(
    (item.metadata.target_date as string | undefined) ?? "",
  );
  const [projectStartedAt, setProjectStartedAt] = useState(
    (item.metadata.started_at as string | undefined) ?? "",
  );
  const [projectId, setProjectId] = useState(
    (item.metadata.project_id as string | undefined) ?? "",
  );
  const [meetings, setMeetings] = useState<Item[]>([]);
  const [projects, setProjects] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const initialRecurrence = parseRecurrence(item.metadata);
  const [recurrenceInterval, setRecurrenceInterval] = useState<
    RecurrenceInterval | ""
  >(initialRecurrence?.interval ?? "");
  const [recurrenceAnchor, setRecurrenceAnchor] = useState(
    initialRecurrence?.anchor_date ?? "",
  );

  useEffect(() => {
    setContent(item.content);
    setMeetingTitle((item.metadata.title as string | undefined) ?? "");
    setTags(item.tags);
    setOwner((item.metadata.owner as string | undefined) ?? "");
    setDueDate((item.metadata.due_date as string | undefined) ?? "");
    setMeetingId((item.metadata.meeting_id as string | undefined) ?? "");
    setRenewalDate((item.metadata.renewal_date as string | undefined) ?? "");
    setAmount(String(item.metadata.amount ?? ""));
    setCadence((item.metadata.cadence as string | undefined) ?? "");
    setSubscriptionNotes((item.metadata.notes as string | undefined) ?? "");
    setProjectNotes((item.metadata.notes as string | undefined) ?? "");
    setProjectStatus(
      ((item.metadata.status as ProjectStatus | undefined) ?? "active") as ProjectStatus,
    );
    setProjectPriority(
      (item.metadata.priority as ProjectPriority | undefined) ?? "",
    );
    setProjectArea((item.metadata.area as string | undefined) ?? "");
    setProjectTargetDate(
      (item.metadata.target_date as string | undefined) ?? "",
    );
    setProjectStartedAt((item.metadata.started_at as string | undefined) ?? "");
    setProjectId((item.metadata.project_id as string | undefined) ?? "");
    const rec = parseRecurrence(item.metadata);
    setRecurrenceInterval(rec?.interval ?? "");
    setRecurrenceAnchor(rec?.anchor_date ?? "");
  }, [item]);

  useEffect(() => {
    if (item.type !== "task") return;
    void listItems({ type: "meeting", status: "all", limit: 50 }).then(
      setMeetings,
    );
    void listActiveProjectsForPicker().then(setProjects);
  }, [item.type]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      onToast("Content cannot be empty.", "error");
      return;
    }

    setSaving(true);
    try {
      const mergedTags = mergeTagsForSave(tags, trimmed);
      const metadata: Record<string, unknown> = { ...item.metadata };

      if (item.type === "task") {
        const linked = meetingId.trim() || null;
        metadata.owner = owner.trim() || null;
        metadata.due_date = dueDate.trim() || null;
        metadata.meeting_id = linked;
        metadata.project_id = projectId.trim() || null;
        if (recurrenceInterval) {
          Object.assign(
            metadata,
            recurrenceToMetadata(recurrenceInterval, recurrenceAnchor),
          );
        } else {
          delete metadata.recurrence;
          delete metadata.recurrence_rule;
        }
      }
      if (item.type === "subscription") {
        metadata.renewal_date = renewalDate.trim() || null;
        metadata.amount = amount.trim() || null;
        metadata.cadence = cadence.trim() || null;
        metadata.notes = subscriptionNotes.trim() || null;
        if (recurrenceInterval) {
          Object.assign(
            metadata,
            recurrenceToMetadata(recurrenceInterval, recurrenceAnchor),
          );
        } else {
          delete metadata.recurrence;
          delete metadata.recurrence_rule;
        }
      }
      if (item.type === "project") {
        metadata.status = projectStatus || "active";
        metadata.notes = projectNotes.trim() || null;
        metadata.priority = projectPriority || null;
        metadata.area = projectArea.trim() || null;
        metadata.target_date = projectTargetDate.trim() || null;
        metadata.started_at = projectStartedAt.trim() || null;
      }
      if (item.type === "meeting") {
        metadata.title = meetingTitle.trim() || null;
      }

      const updated = await updateItem(item.id, {
        content: trimmed,
        tags: mergedTags,
        metadata,
      });

      await emit("item:saved", {});
      onSaved(updated);
      onToast("Changes saved.", "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      onToast(message || "Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(copyLinks: boolean) {
    setDuplicating(true);
    try {
      const copy = await duplicateItem(item.id, { copyLinks });
      await emit("item:saved", {});
      onToast("Item duplicated.", "success");
      onDuplicated?.(copy);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Duplicate failed",
        "error",
      );
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-pds-muted">
          Edit {item.type}
        </h3>
        <span className="truncate text-[10px] text-pds-subtle">{item.id}</span>
      </div>

      {item.type === "task" && onNavigateToFocus && (
        <TaskFocusStartButton
          task={item}
          onNavigateToFocus={onNavigateToFocus}
        />
      )}

      {item.type === "meeting" && (
        <label className="block text-[11px] text-pds-muted">
          Title
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            disabled={saving}
            placeholder="Meeting title…"
            className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text focus:border-pds-muted focus:outline-none"
          />
        </label>
      )}

      <label className="block text-[11px] text-pds-muted">
        {item.type === "subscription" ||
        item.type === "project" ||
        item.type === "meeting"
          ? item.type === "meeting"
            ? "Notes"
            : "Title"
          : "Content"}
        {item.type === "subscription" || item.type === "project" ? (
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={saving}
            placeholder={
              item.type === "project" ? "Project name…" : "Service name…"
            }
            className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text focus:border-pds-muted focus:outline-none"
          />
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={item.type === "meeting" ? 6 : 3}
            disabled={saving}
            className="mt-1 w-full resize-y rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text focus:border-pds-muted focus:outline-none"
          />
        )}
      </label>

      {item.type === "subscription" && (
        <label className="block text-[11px] text-pds-muted">
          Notes
          <textarea
            value={subscriptionNotes}
            onChange={(e) => setSubscriptionNotes(e.target.value)}
            rows={2}
            disabled={saving}
            placeholder="Cancel after next month…"
            className="mt-1 w-full resize-y rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text focus:border-pds-muted focus:outline-none"
          />
        </label>
      )}

      {item.type === "project" && (
        <label className="block text-[11px] text-pds-muted">
          Notes
          <textarea
            value={projectNotes}
            onChange={(e) => setProjectNotes(e.target.value)}
            rows={2}
            disabled={saving}
            placeholder="Goals, scope, links…"
            className="mt-1 w-full resize-y rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text focus:border-pds-muted focus:outline-none"
          />
        </label>
      )}

      <div className="block text-[11px] text-pds-muted">
        Tags
        <TagAddField
          className="mt-1"
          tags={tags}
          onChange={setTags}
          disabled={saving}
        />
      </div>

      {(item.type === "task" || item.type === "subscription") && (
        <>
          <label className="block text-[11px] text-pds-muted">
            Recurrence
            <select
              value={recurrenceInterval}
              onChange={(e) =>
                setRecurrenceInterval(
                  e.target.value as RecurrenceInterval | "",
                )
              }
              disabled={saving}
              className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
            >
              {RECURRENCE_INTERVAL_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {recurrenceInterval && (
            <label className="block text-[11px] text-pds-muted">
              Recurrence anchor (optional)
              <input
                type="date"
                value={recurrenceAnchor}
                onChange={(e) => setRecurrenceAnchor(e.target.value)}
                disabled={saving}
                className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
              />
            </label>
          )}
        </>
      )}

      {item.type === "subscription" && (
        <>
          <label className="block text-[11px] text-pds-muted">
            Renewal date
            <input
              type="date"
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
            />
          </label>
          <label className="block text-[11px] text-pds-muted">
            Amount
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
            />
          </label>
          <label className="block text-[11px] text-pds-muted">
            Cadence
            <input
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              placeholder="monthly, yearly…"
              disabled={saving}
              className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
            />
          </label>
        </>
      )}

      {item.type === "project" && (
        <>
          <label className="block text-[11px] text-pds-muted">
            Status
            <select
              value={projectStatus}
              onChange={(e) =>
                setProjectStatus(e.target.value as ProjectStatus)
              }
              disabled={saving}
              className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
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
              value={projectPriority}
              onChange={(e) =>
                setProjectPriority((e.target.value as ProjectPriority) || "")
              }
              disabled={saving}
              className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
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
              value={projectArea}
              onChange={(e) => setProjectArea(e.target.value)}
              list="edit-project-area-presets"
              disabled={saving}
              className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
            />
            <datalist id="edit-project-area-presets">
              {PROJECT_AREA_PRESETS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>
          <label className="block text-[11px] text-pds-muted">
            Target date
            <input
              type="date"
              value={projectTargetDate}
              onChange={(e) => setProjectTargetDate(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
            />
          </label>
          <label className="block text-[11px] text-pds-muted">
            Started
            <input
              type="date"
              value={projectStartedAt}
              onChange={(e) => setProjectStartedAt(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
            />
          </label>
        </>
      )}

      {item.type === "task" && (
        <>
          <label className="block text-[11px] text-pds-muted">
            Owner
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
            />
          </label>
          <label className="block text-[11px] text-pds-muted">
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
            />
          </label>
          {meetings.length > 0 && (
            <label className="block text-[11px] text-pds-muted">
              Linked meeting
              <select
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                disabled={saving}
                className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
              >
                <option value="">None</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.content.slice(0, 50).replace(/\s+/g, " ")}
                    {m.content.length > 50 ? "…" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {projects.length > 0 && (
            <label className="block text-[11px] text-pds-muted">
              Project
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={saving}
                className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.content.slice(0, 50).replace(/\s+/g, " ")}
                    {p.content.length > 50 ? "…" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving || duplicating}
          className="pds-btn-primary flex-1 py-1.5 text-xs"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving || duplicating}
          className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-muted"
        >
          Cancel
        </button>
      </div>
      {item.type !== "work_block" && (
        <div className="flex flex-wrap gap-2 border-t border-pds-border pt-2">
          <button
            type="button"
            disabled={saving || duplicating}
            onClick={() => void handleDuplicate(false)}
            className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-muted disabled:opacity-40"
          >
            {duplicating ? "Duplicating…" : "Duplicate"}
          </button>
          <button
            type="button"
            disabled={saving || duplicating}
            onClick={() => void handleDuplicate(true)}
            className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-muted disabled:opacity-40"
          >
            Duplicate + links
          </button>
        </div>
      )}
    </form>
  );
}
