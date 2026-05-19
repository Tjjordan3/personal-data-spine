import { useCallback, useEffect, useState } from "react";
import {
  createLink,
  getRelatedItems,
  linkTypeLabel,
  type LinkType,
} from "../lib/db/links";
import { getItemById } from "../lib/db/items";
import { meetingTitle } from "../lib/meeting/display";
import type { Item } from "../lib/db/types";
import { LinkPickerModal } from "./LinkPickerModal";

function relatedLabel(item: Item): string {
  if (item.type === "meeting") return meetingTitle(item);
  const line = item.content.replace(/\s+/g, " ").trim();
  return line.length > 72 ? `${line.slice(0, 72)}…` : line || item.type;
}

interface ProjectRelatedSectionProps {
  project: Item;
  onNavigateToItem: (item: Item) => void;
  onToast: (message: string, kind: "success" | "error") => void;
  onChanged: () => void;
  embedded?: boolean;
}

export function ProjectRelatedSection({
  project,
  onNavigateToItem,
  onToast,
  onChanged,
  embedded = false,
}: ProjectRelatedSectionProps) {
  const [related, setRelated] = useState<
    Awaited<ReturnType<typeof getRelatedItems>>
  >([]);
  const [linkType, setLinkType] = useState<LinkType>("related");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRelated(await getRelatedItems(project.id));
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handlePickTarget(targetId: string) {
    try {
      const target = await getItemById(targetId);
      if (!target) {
        onToast("Target item not found.", "error");
        return;
      }
      await createLink(project.id, target.id, linkType);
      if (linkType === "related") {
        await createLink(target.id, project.id, "related");
      }
      setPickerOpen(false);
      onToast("Link created.", "success");
      onChanged();
      void refresh();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to link", "error");
    }
  }

  return (
    <section
      className={
        embedded
          ? "flex min-h-0 flex-1 flex-col border-t border-pds-border p-3"
          : "pds-card mt-4 p-3"
      }
    >
      <LinkPickerModal
        open={pickerOpen}
        sourceItem={project}
        linkType={linkType}
        onClose={() => setPickerOpen(false)}
        onPick={handlePickTarget}
      />
      <h3 className="text-pds-sm font-medium uppercase text-pds-muted">
        Related items
      </h3>
      <p className="mt-0.5 text-pds-caption text-pds-subtle">
        Link subscriptions, tasks, notes, meetings, and other projects.
      </p>
      <div className="mt-3 space-y-2">
        <select
          value={linkType}
          onChange={(e) => setLinkType(e.target.value as LinkType)}
          className="w-full rounded border border-pds-border bg-pds-input px-2 py-1 text-pds-caption text-pds-text"
        >
          <option value="related">related</option>
          <option value="source">source</option>
          <option value="references">references</option>
          <option value="action_of">action_of</option>
          <option value="has_action">has_action</option>
        </select>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full rounded bg-pds-accent py-1 text-pds-caption font-medium text-pds-accent-fg"
        >
          Find item to link…
        </button>
      </div>
      <div
        className={
          embedded
            ? "mt-3 min-h-0 flex-1 overflow-auto"
            : "mt-3 max-h-48 overflow-auto"
        }
      >
        {loading && (
          <p className="text-pds-caption text-pds-muted">Loading…</p>
        )}
        {!loading && related.length === 0 && (
          <p className="text-pds-caption text-pds-muted">No links yet.</p>
        )}
        <ul className="space-y-1.5">
          {related.map(({ item: rel, link, direction }) => (
            <li key={`${link.id}-${rel.id}`}>
              <button
                type="button"
                onClick={() => onNavigateToItem(rel)}
                className="w-full rounded border border-pds-border bg-pds-panel/50 px-2 py-1.5 text-left hover:border-pds-muted"
              >
                <span className="text-pds-caption uppercase text-pds-muted">
                  {rel.type} · {direction} · {linkTypeLabel(link.link_type)}
                </span>
                <p className="mt-0.5 line-clamp-2 text-pds-sm text-pds-text">
                  {relatedLabel(rel)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
