import type { ItemStatus } from "../lib/db/itemStatus";
import type { ItemType } from "../lib/db/types";

export interface FacetState {
  query: string;
  type: ItemType | "all";
  tag: string;
  status: ItemStatus | "all";
  dateFrom: string;
  dateTo: string;
  dueSoon: boolean;
}

interface SearchFacetsBarProps {
  facets: FacetState;
  onChange: (patch: Partial<FacetState>) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

const TYPE_OPTIONS: Array<{ label: string; value: ItemType | "all" }> = [
  { label: "All types", value: "all" },
  { label: "Notes", value: "note" },
  { label: "Meetings", value: "meeting" },
  { label: "Tasks", value: "task" },
  { label: "Subscriptions", value: "subscription" },
  { label: "Projects", value: "project" },
];

const TAG_OPTIONS = [
  "all",
  "#urgent",
  "#meeting",
  "#task",
  "#bug",
  "#idea",
  "#project",
  "#subscription",
] as const;

const STATUS_OPTIONS: Array<{ label: string; value: ItemStatus | "all" }> = [
  { label: "Active", value: "active" },
  { label: "Done", value: "done" },
  { label: "Archived", value: "archived" },
  { label: "All statuses", value: "all" },
];

export function SearchFacetsBar({
  facets,
  onChange,
  searchRef,
}: SearchFacetsBarProps) {
  return (
    <div className="space-y-2 border-b border-pds-border px-4 py-2">
      <input
        ref={searchRef}
        value={facets.query}
        onChange={(e) => onChange({ query: e.target.value })}
        placeholder="Search… (/ to focus)"
        className="w-full rounded border border-pds-border bg-pds-panel px-3 py-2 text-pds-base text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-pds-sm text-pds-muted">From</label>
        <input
          type="date"
          value={facets.dateFrom}
          onChange={(e) => onChange({ dateFrom: e.target.value })}
          className="rounded border border-pds-border bg-pds-input px-2 py-1 text-pds-sm text-pds-text"
        />
        <label className="text-pds-sm text-pds-muted">To</label>
        <input
          type="date"
          value={facets.dateTo}
          onChange={(e) => onChange({ dateTo: e.target.value })}
          className="rounded border border-pds-border bg-pds-input px-2 py-1 text-pds-sm text-pds-text"
        />
        <button
          type="button"
          onClick={() => onChange({ dueSoon: !facets.dueSoon })}
          className={`rounded px-2 py-0.5 text-pds-sm ${
            facets.dueSoon
              ? "bg-amber-600 text-white"
              : "bg-pds-panel text-pds-muted"
          }`}
        >
          Due soon (7d)
        </button>
      </div>
      <FacetRow>
        {TYPE_OPTIONS.map((opt) => (
          <FacetChip
            key={opt.value}
            active={facets.type === opt.value}
            onClick={() => onChange({ type: opt.value })}
            label={opt.label}
          />
        ))}
      </FacetRow>
      <FacetRow>
        {STATUS_OPTIONS.map((opt) => (
          <FacetChip
            key={opt.value}
            active={facets.status === opt.value}
            onClick={() => onChange({ status: opt.value })}
            label={opt.label}
            activeClass="pds-chip-active"
          />
        ))}
      </FacetRow>
      <FacetRow>
        {TAG_OPTIONS.map((tag) => (
          <FacetChip
            key={tag}
            active={facets.tag === tag}
            onClick={() => onChange({ tag })}
            label={tag === "all" ? "All tags" : tag}
            activeClass="pds-chip-active"
          />
        ))}
      </FacetRow>
    </div>
  );
}

function FacetRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function FacetChip({
  label,
  active,
  onClick,
  activeClass = "bg-pds-accent text-pds-accent-fg",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-0.5 text-pds-sm ${
        active ? activeClass : "bg-pds-panel text-pds-muted"
      }`}
    >
      {label}
    </button>
  );
}
