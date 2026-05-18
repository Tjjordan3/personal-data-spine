import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import {
  deleteItem,
  deleteMeetingWithTasks,
  setItemStatus,
} from "../lib/db/items";
import { getItemStatus, type ItemStatus } from "../lib/db/itemStatus";
import type { SearchResult } from "../lib/db/search";
import {
  formatProjectStatusLabel,
  formatTaskRollupLine,
  getProjectRollupsMap,
  type ProjectTaskRollup,
} from "../lib/db/projects";
import { getCategoryById } from "../lib/subscriptions/catalog";
import type { Item, ItemType, ProjectMetadata } from "../lib/db/types";

interface ItemListProps {
  results: SearchResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  error: string | null;
  onChanged: () => void;
  onToast: (message: string, kind: "success" | "error") => void;
  onEdit: (id: string) => void;
  emptyMessage?: string;
  /** When true, loads open/overdue task counts for project rows. */
  loadProjectRollups?: boolean;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function preview(content: string, max = 160): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

function typeBadgeClass(type: ItemType): string {
  if (type === "meeting") return "bg-violet-900/50 text-violet-200";
  if (type === "task") return "bg-amber-900/50 text-amber-200";
  if (type === "subscription") return "bg-sky-900/50 text-sky-200";
  if (type === "project") return "bg-emerald-900/50 text-emerald-200";
  return "bg-pds-chip text-pds-chip-fg";
}

function statusLabel(status: ItemStatus): string {
  if (status === "done") return "Done";
  if (status === "archived") return "Archived";
  return "";
}

export function ItemList({
  results,
  selectedId,
  onSelect,
  loading,
  error,
  onChanged,
  onToast,
  onEdit,
  emptyMessage,
  loadProjectRollups = false,
}: ItemListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [projectRollups, setProjectRollups] = useState<
    Map<string, ProjectTaskRollup>
  >(new Map());

  useEffect(() => {
    if (!loadProjectRollups) {
      setProjectRollups(new Map());
      return;
    }
    const projectIds = results
      .map((r) => r.item)
      .filter((i) => i.type === "project")
      .map((i) => i.id);
    if (projectIds.length === 0) {
      setProjectRollups(new Map());
      return;
    }
    void getProjectRollupsMap(projectIds).then(setProjectRollups);
  }, [loadProjectRollups, results]);

  async function handleMark(id: string, status: ItemStatus) {
    setBusyId(id);
    try {
      await setItemStatus(id, status);
      await emit("item:saved", {});
      onChanged();
      onToast(
        status === "done"
          ? "Marked as done."
          : status === "archived"
            ? "Archived."
            : "Restored to active.",
        "success",
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Failed to update item",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: Item) {
    const meetingExtra =
      item.type === "meeting"
        ? "\n\nLinked tasks will also be deleted."
        : "";
    const message = `Delete this ${item.type}?${meetingExtra}`;

    if (!window.confirm(message)) return;

    setBusyId(item.id);
    try {
      if (item.type === "meeting") {
        const count = await deleteMeetingWithTasks(item.id);
        onToast(`Deleted meeting and ${count - 1} linked task(s).`, "success");
      } else {
        await deleteItem(item.id);
        onToast("Item deleted.", "success");
      }
      await emit("item:saved", {});
      onChanged();
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Failed to delete item",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="px-4 py-8 text-sm text-pds-muted">Loading items…</p>;
  }

  if (error) {
    return (
      <p className="mx-4 my-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
        {error}
      </p>
    );
  }

  if (results.length === 0) {
    return (
      <p className="px-4 py-8 text-sm text-pds-muted">
        {emptyMessage ??
          "No items in this view. Use Alt+Shift+Space to quick-capture."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2 p-4">
      {results.map(({ item, reasons }) => {
        const status = getItemStatus(item);
        const selected = selectedId === item.id;
        const isDone = status === "done";
        const isArchived = status === "archived";
        const disabled = busyId === item.id;

        return (
          <li
            key={item.id}
            className={`rounded-lg border px-3 py-2.5 transition ${
              selected
                ? "border-violet-600 bg-violet-950/30"
                : isArchived
                  ? "border-pds-border/60 bg-pds-input/80 opacity-70"
                  : isDone
                    ? "border-pds-border bg-pds-panel/40"
                    : "border-pds-border bg-pds-panel/60 hover:border-pds-border"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className="mb-1 w-full text-left"
            >
              <p className="text-[10px] text-violet-400/90">
                {reasons.join(" · ")}
              </p>
            </button>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${typeBadgeClass(item.type)}`}
                >
                  {item.type}
                </span>
                {status !== "active" && (
                  <span className="rounded bg-pds-chip px-1.5 py-0.5 text-[10px] text-pds-muted">
                    {statusLabel(status)}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-pds-muted">
                {formatTime(item.created_at)}
              </span>
            </div>
            <p
              className={`mt-1 text-sm leading-relaxed ${
                isDone
                  ? "text-pds-muted line-through"
                  : isArchived
                    ? "text-pds-muted"
                    : "text-pds-text"
              }`}
            >
              {preview(item.content)}
            </p>
            {(item.type === "subscription" || item.type === "project") && (
              <MetadataNotesLine metadata={item.metadata} />
            )}
            {item.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-pds-chip px-1.5 py-0.5 text-[10px] text-pds-muted"
                  >
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}
            {item.type === "task" && (
              <TaskMeta metadata={item.metadata} />
            )}
            {item.type === "subscription" && (
              <SubscriptionMeta metadata={item.metadata} />
            )}
            {item.type === "project" && (
              <ProjectMeta
                metadata={item.metadata}
                rollup={projectRollups.get(item.id)}
              />
            )}
            <ItemActions
              item={item}
              status={status}
              disabled={disabled}
              onEdit={() => onEdit(item.id)}
              onMark={handleMark}
              onDelete={() => void handleDelete(item)}
            />
          </li>
        );
      })}
    </ul>
  );
}

function ItemActions({
  item,
  status,
  disabled,
  onEdit,
  onMark,
  onDelete,
}: {
  item: Item;
  status: ItemStatus;
  disabled: boolean;
  onEdit: () => void;
  onMark: (id: string, status: ItemStatus) => void;
  onDelete: () => void;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-pds-border/80 pt-2">
      <ActionButton
        label="Edit"
        disabled={disabled}
        onClick={onEdit}
        className="text-violet-400 hover:bg-violet-950/50"
      />
      {status !== "done" && (
        <ActionButton
          label="Done"
          disabled={disabled}
          onClick={() => void onMark(item.id, "done")}
          className="text-emerald-400 hover:bg-emerald-950/50"
        />
      )}
      {status !== "archived" && (
        <ActionButton
          label="Archive"
          disabled={disabled}
          onClick={() => void onMark(item.id, "archived")}
          className="text-pds-muted hover:bg-pds-chip"
        />
      )}
      {status !== "active" && (
        <ActionButton
          label="Restore"
          disabled={disabled}
          onClick={() => void onMark(item.id, "active")}
          className="text-sky-400 hover:bg-sky-950/50"
        />
      )}
      <ActionButton
        label="Delete"
        disabled={disabled}
        onClick={onDelete}
        className="text-red-400 hover:bg-red-950/50"
      />
    </div>
  );
}

function ActionButton({
  label,
  disabled,
  onClick,
  className,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-2 py-0.5 text-[11px] disabled:opacity-40 ${className}`}
    >
      {label}
    </button>
  );
}

function MetadataNotesLine({
  metadata,
}: {
  metadata: Record<string, unknown>;
}) {
  const notes = (metadata.notes as string | null | undefined)?.trim();
  if (!notes) return null;

  return (
    <p className="mt-0.5 text-[11px] leading-snug text-pds-subtle">
      {preview(notes, 200)}
    </p>
  );
}

function ProjectMeta({
  metadata,
  rollup,
}: {
  metadata: Record<string, unknown>;
  rollup?: ProjectTaskRollup;
}) {
  const meta = metadata as ProjectMetadata;
  const status = meta.status ?? "active";
  const parts: string[] = [];
  parts.push(formatProjectStatusLabel(status));
  if (meta.area?.trim()) parts.push(meta.area.trim());
  if (meta.priority) parts.push(meta.priority);
  if (meta.target_date) parts.push(`Target ${meta.target_date}`);
  const rollupLine = rollup ? formatTaskRollupLine(rollup) : null;
  if (rollupLine) parts.push(rollupLine);
  if (parts.length === 0) return null;

  return (
    <p className="mt-1.5 text-[11px] text-pds-muted">{parts.join(" · ")}</p>
  );
}

function SubscriptionMeta({ metadata }: { metadata: Record<string, unknown> }) {
  const renewal = metadata.renewal_date as string | null | undefined;
  const amount = metadata.amount as string | number | null | undefined;
  const cadence = metadata.cadence as string | null | undefined;
  const categoryId = metadata.category as string | undefined;
  const categoryLabel = categoryId
    ? (getCategoryById(categoryId)?.label ??
      (categoryId === "custom" ? "Custom" : categoryId))
    : "";
  if (!renewal && !amount && !cadence && !categoryLabel) return null;

  return (
    <p className="mt-1.5 text-[11px] text-pds-muted">
      {categoryLabel && <span>{categoryLabel}</span>}
      {renewal && (
        <span>
          {categoryLabel ? " · " : ""}
          Renews: {renewal}
        </span>
      )}
      {amount != null && amount !== "" && (
        <span>
          {renewal ? " · " : ""}${amount}
        </span>
      )}
      {cadence && (
        <span>
          {(renewal || amount) ? " · " : ""}
          {cadence}
        </span>
      )}
    </p>
  );
}

function TaskMeta({ metadata }: { metadata: Record<string, unknown> }) {
  const owner = metadata.owner as string | null | undefined;
  const due = metadata.due_date as string | null | undefined;
  if (!owner && !due) return null;

  return (
    <p className="mt-1.5 text-[11px] text-pds-muted">
      {owner && <span>Owner: {owner}</span>}
      {owner && due && <span> · </span>}
      {due && <span>Due: {due}</span>}
    </p>
  );
}
