import type { SVGProps } from "react";
import type { ItemType } from "../../lib/db/types";

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} satisfies SVGProps<SVGPathElement>;

export const GRAPH_TYPE_LABELS: Record<ItemType, string> = {
  note: "Note",
  meeting: "Meeting",
  task: "Task",
  subscription: "Subscription",
  project: "Project",
  work_block: "Work block",
};

/** Circle fill/stroke for graph nodes (focused adds emerald ring in GraphView). */
export function graphNodeCircleClass(type: ItemType, focused: boolean): string {
  if (focused) {
    return "fill-pds-chip stroke-emerald-500 dark:stroke-emerald-400";
  }
  switch (type) {
    case "meeting":
      return "fill-violet-900/55 stroke-violet-600/70 dark:fill-violet-950/80 dark:stroke-violet-500/60";
    case "task":
      return "fill-amber-900/55 stroke-amber-600/70 dark:fill-amber-950/80 dark:stroke-amber-500/60";
    case "subscription":
      return "fill-sky-900/55 stroke-sky-600/70 dark:fill-sky-950/80 dark:stroke-sky-500/60";
    case "project":
      return "fill-emerald-900/55 stroke-emerald-600/70 dark:fill-emerald-950/80 dark:stroke-emerald-500/60";
    case "work_block":
      return "fill-pds-chip stroke-pds-subtle";
    default:
      return "fill-pds-chip stroke-pds-subtle";
  }
}

export function graphNodeIconClass(type: ItemType): string {
  switch (type) {
    case "meeting":
      return "text-violet-200 dark:text-violet-300";
    case "task":
      return "text-amber-200 dark:text-amber-300";
    case "subscription":
      return "text-sky-200 dark:text-sky-300";
    case "project":
      return "text-emerald-200 dark:text-emerald-300";
    case "work_block":
      return "text-pds-muted";
    default:
      return "text-pds-chip-fg";
  }
}

interface GraphNodeIconPathsProps {
  type: ItemType;
}

/** 16×16 path content for embedding inside graph SVG. */
export function GraphNodeIconPaths({ type }: GraphNodeIconPathsProps) {
  switch (type) {
    case "meeting":
      return (
        <>
          <circle cx="5.5" cy="6.25" r="2" {...strokeProps} />
          <circle cx="10.5" cy="6.25" r="2" {...strokeProps} />
          <path
            d="M2.75 13.25c.65-2 1.9-3 2.75-3s2.1 1 2.75 3M8.75 13.25c.65-2 1.9-3 2.75-3s2.1 1 2.75 3"
            {...strokeProps}
          />
        </>
      );
    case "subscription":
      return (
        <>
          <path d="M3.5 5.25h9v6.5h-9z" {...strokeProps} />
          <path d="M5.25 11.75v2M10.75 11.75v2M3.5 8.25h9" {...strokeProps} />
        </>
      );
    case "project":
      return (
        <>
          <path d="M2.75 5.25h5.25v5.25H2.75z" {...strokeProps} />
          <path d="M8 3.5h5.25v5.25H8z" {...strokeProps} />
          <path d="M8 10.25h5.25v2.25H8z" {...strokeProps} />
        </>
      );
    case "task":
      return (
        <>
          <rect x="3.5" y="3.5" width="9" height="9" rx="1.25" {...strokeProps} />
          <path d="M5.75 8.25l1.75 1.75 3.75-4" {...strokeProps} />
        </>
      );
    case "work_block":
      return (
        <>
          <circle cx="8" cy="8" r="5.25" {...strokeProps} />
          <path d="M8 5v3.25l2.25 1.25" {...strokeProps} />
        </>
      );
    case "note":
    default:
      return (
        <>
          <path
            d="M4.5 2.75h5.5l2.25 2.25v8.25H4.5V2.75z"
            {...strokeProps}
          />
          <path d="M10 2.75v2.25h2.25M6.5 8h3M6.5 10.25h3" {...strokeProps} />
        </>
      );
  }
}
