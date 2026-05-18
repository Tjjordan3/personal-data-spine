import { useState } from "react";
import { emit } from "@tauri-apps/api/event";
import {
  deleteItem,
  deleteMeetingWithTasks,
  setItemStatus,
} from "../lib/db/items";
import { getItemStatus, type ItemStatus } from "../lib/db/itemStatus";
import type { Item, ItemType } from "../lib/db/types";

interface ItemListProps {
  items: Item[];
  loading: boolean;
  error: string | null;
  onChanged: () => void;
  onToast: (message: string, kind: "success" | "error") => void;
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
  return "bg-zinc-800 text-zinc-300";
}

function statusLabel(status: ItemStatus): string {
  if (status === "done") return "Done";
  if (status === "archived") return "Archived";
  return "";
}

export function ItemList({
  items,
  loading,
  error,
  onChanged,
  onToast,
}: ItemListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

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
    return <p className="px-4 py-8 text-sm text-zinc-500">Loading items…</p>;
  }

  if (error) {
    return (
      <p className="mx-4 my-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
        {error}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="px-4 py-8 text-sm text-zinc-500">
        No items in this view. Use Alt+Shift+Space to quick-capture.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2 p-4">
      {items.map((item) => {
        const status = getItemStatus(item);
        const isDone = status === "done";
        const isArchived = status === "archived";
        const disabled = busyId === item.id;

        return (
          <li
            key={item.id}
            className={`rounded-lg border px-3 py-2.5 transition ${
              isArchived
                ? "border-zinc-800/60 bg-zinc-950/80 opacity-70"
                : isDone
                  ? "border-zinc-800 bg-zinc-900/40"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${typeBadgeClass(item.type)}`}
                >
                  {item.type}
                </span>
                {status !== "active" && (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {statusLabel(status)}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-zinc-500">
                {formatTime(item.created_at)}
              </span>
            </div>
            <p
              className={`mt-1 text-sm leading-relaxed ${
                isDone
                  ? "text-zinc-500 line-through"
                  : isArchived
                    ? "text-zinc-500"
                    : "text-zinc-200"
              }`}
            >
              {preview(item.content)}
            </p>
            {item.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                  >
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}
            {item.type === "task" && (
              <TaskMeta metadata={item.metadata} />
            )}
            <ItemActions
              item={item}
              status={status}
              disabled={disabled}
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
  onMark,
  onDelete,
}: {
  item: Item;
  status: ItemStatus;
  disabled: boolean;
  onMark: (id: string, status: ItemStatus) => void;
  onDelete: () => void;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-zinc-800/80 pt-2">
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
          className="text-zinc-400 hover:bg-zinc-800"
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

function TaskMeta({ metadata }: { metadata: Record<string, unknown> }) {
  const owner = metadata.owner as string | null | undefined;
  const due = metadata.due_date as string | null | undefined;
  if (!owner && !due) return null;

  return (
    <p className="mt-1.5 text-[11px] text-zinc-500">
      {owner && <span>Owner: {owner}</span>}
      {owner && due && <span> · </span>}
      {due && <span>Due: {due}</span>}
    </p>
  );
}
