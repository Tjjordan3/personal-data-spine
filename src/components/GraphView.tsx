import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  getGraphData,
  pickDefaultFocusId,
  type GraphEdge,
} from "../lib/db/graph";
import { linkTypeLabel } from "../lib/db/links";
import type { Item, ItemType } from "../lib/db/types";
import {
  GRAPH_TYPE_LABELS,
  GraphNodeIconPaths,
  graphNodeCircleClass,
  graphNodeIconClass,
} from "./icons/GraphNodeIcon";

interface GraphViewProps {
  focusId: string | null;
  onSelectItem: (id: string) => void;
}

interface LayoutNode {
  id: string;
  item: Item;
  x: number;
  y: number;
}

const LAYOUT_BASE = 360;

const GRAPH_CHROME =
  "rounded-sm border border-pds-border bg-pds-input/50";

const LEGEND_TYPE_ORDER: ItemType[] = [
  "meeting",
  "task",
  "project",
  "subscription",
  "note",
  "work_block",
];

function layoutScale(width: number, height: number): number {
  return Math.min(width, height) / LAYOUT_BASE;
}

function nodeRadii(scale: number) {
  return {
    focused: Math.max(18, 18 * scale),
    normal: Math.max(14, 14 * scale),
  };
}

function iconSize(scale: number): number {
  return Math.min(20, Math.max(16, 16 * Math.min(scale, 1.15)));
}

function buildAdjacency(edges: GraphEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, new Set());
    if (!adj.has(edge.to)) adj.set(edge.to, new Set());
    adj.get(edge.from)!.add(edge.to);
    adj.get(edge.to)!.add(edge.from);
  }
  return adj;
}

function computeLayout(
  nodes: Item[],
  edges: GraphEdge[],
  focusId: string,
  width: number,
  height: number,
): LayoutNode[] {
  const scale = layoutScale(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const adj = buildAdjacency(edges);

  const depths = new Map<string, number>();
  const queue: string[] = [focusId];
  depths.set(focusId, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const depth = depths.get(current) ?? 0;
    for (const next of adj.get(current) ?? []) {
      if (!depths.has(next)) {
        depths.set(next, depth + 1);
        queue.push(next);
      }
    }
  }

  for (const node of nodes) {
    if (!depths.has(node.id)) depths.set(node.id, 2);
  }

  const byDepth = new Map<number, Item[]>();
  for (const node of nodes) {
    const d = depths.get(node.id) ?? 1;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(node);
  }

  const layout: LayoutNode[] = [];

  for (const [depth, group] of byDepth.entries()) {
    if (depth === 0) {
      const center = group.find((n) => n.id === focusId) ?? group[0];
      layout.push({ id: center.id, item: center, x: cx, y: cy });
      for (const node of group) {
        if (node.id !== center.id) {
          layout.push({ id: node.id, item: node, x: cx, y: cy - 56 * scale });
        }
      }
      continue;
    }

    const radius = (92 + depth * 74) * scale;
    group.forEach((node, index) => {
      const angle =
        (index / Math.max(group.length, 1)) * Math.PI * 2 - Math.PI / 2;
      layout.push({
        id: node.id,
        item: node,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    });
  }

  return layout;
}

/** Light spring refinement on radial seed positions. */
function refineSpringLayout(
  layout: LayoutNode[],
  edges: GraphEdge[],
  focusId: string,
  width: number,
  height: number,
  iterations = 56,
): LayoutNode[] {
  const scale = layoutScale(width, height);
  const pad = 32 * scale;
  const minDist = 36 * scale;
  const nodes = layout.map((n) => ({ ...n, vx: 0, vy: 0 }));
  const cx = width / 2;
  const cy = height / 2;

  for (let iter = 0; iter < iterations; iter++) {
    for (const node of nodes) {
      node.vx = 0;
      node.vy = 0;
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.max(Math.hypot(dx, dy), minDist);
        const repulse = (2000 * scale * scale) / (dist * dist);
        dx = (dx / dist) * repulse;
        dy = (dy / dist) * repulse;
        a.vx += dx;
        a.vy += dy;
        b.vx -= dx;
        b.vy -= dy;
      }
    }

    for (const edge of edges) {
      const a = nodes.find((n) => n.id === edge.from);
      const b = nodes.find((n) => n.id === edge.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const target = 118 * scale;
      const pull = (dist - target) * 0.04;
      const fx = (dx / dist) * pull;
      const fy = (dy / dist) * pull;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    const focus = nodes.find((n) => n.id === focusId);
    if (focus) {
      focus.vx += (cx - focus.x) * 0.02;
      focus.vy += (cy - focus.y) * 0.02;
    }

    for (const node of nodes) {
      node.x += node.vx * 0.15;
      node.y += node.vy * 0.15;
      node.x = Math.max(pad, Math.min(width - pad, node.x));
      node.y = Math.max(pad, Math.min(height - pad, node.y));
    }
  }

  return nodes.map(({ id, item, x, y }) => ({ id, item, x, y }));
}

function preview(content: string, max = 40): string {
  const line = content.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

function nodeTooltip(item: Item): string {
  return `${GRAPH_TYPE_LABELS[item.type]}: ${preview(item.content, 80)}`;
}

export function GraphView({ focusId, onSelectItem }: GraphViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 960, height: 520 });
  const [nodes, setNodes] = useState<Item[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLabels, setShowLabels] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGraphData(focusId);
      setNodes(data.nodes);
      setEdges(data.edges);
    } finally {
      setLoading(false);
    }
  }, [focusId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unlisten = listen("item:saved", () => {
      void load();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [load]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width >= 200 && height >= 200) {
        setViewport({
          width: Math.round(width),
          height: Math.round(height),
        });
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, nodes.length]);

  const effectiveFocus =
    focusId && nodes.some((n) => n.id === focusId)
      ? focusId
      : pickDefaultFocusId(nodes, edges);

  const layout = useMemo(() => {
    if (!effectiveFocus || nodes.length === 0) return [];
    const { width, height } = viewport;
    const seed = computeLayout(nodes, edges, effectiveFocus, width, height);
    return refineSpringLayout(seed, edges, effectiveFocus, width, height);
  }, [nodes, edges, effectiveFocus, viewport]);

  const positions = useMemo(
    () => new Map(layout.map((n) => [n.id, n])),
    [layout],
  );

  const legendTypes = useMemo(() => {
    const present = new Set(nodes.map((n) => n.type));
    return LEGEND_TYPE_ORDER.filter((t) => present.has(t));
  }, [nodes]);

  const scale = layoutScale(viewport.width, viewport.height);
  const nodeR = nodeRadii(scale);
  const glyph = iconSize(scale);

  if (loading) {
    return (
      <div
        className={`flex min-h-80 items-center justify-center ${GRAPH_CHROME} text-pds-sm text-pds-muted`}
      >
        Loading graph…
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div
        className={`flex min-h-80 items-center justify-center ${GRAPH_CHROME} text-pds-sm text-pds-muted`}
      >
        No links to visualize yet.
      </div>
    );
  }

  return (
    <div className={`${GRAPH_CHROME} p-3`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-pds-sm text-pds-muted">
          {effectiveFocus
            ? `Neighborhood of selected item · ${nodes.length} node(s)`
            : "Link graph · click a node to focus"}
        </p>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-pds-caption text-pds-muted">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            className="rounded border-pds-border"
          />
          Show labels
        </label>
      </div>
      {legendTypes.length > 0 && (
        <div
          className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-pds-caption text-pds-muted"
          aria-label="Graph legend"
        >
          {legendTypes.map((type) => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <svg
                viewBox="0 0 16 16"
                className={`h-4 w-4 shrink-0 ${graphNodeIconClass(type)}`}
                aria-hidden
              >
                <GraphNodeIconPaths type={type} />
              </svg>
              {GRAPH_TYPE_LABELS[type]}
            </span>
          ))}
        </div>
      )}
      <div ref={viewportRef} className="h-[min(50vh,32rem)] min-h-80 w-full">
        <svg
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          className="h-full w-full"
          aria-label="Item link graph"
        >
          {edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            return (
              <line
                key={`${edge.from}|${edge.to}|${edge.link_type}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className="stroke-pds-border"
                strokeWidth={1.75 * scale}
              >
                <title>{linkTypeLabel(edge.link_type)}</title>
              </line>
            );
          })}
          {layout.map((node) => {
            const focused = node.id === effectiveFocus;
            const r = focused ? nodeR.focused : nodeR.normal;
            const hitR = r + 12 * scale;
            const showNodeLabel = showLabels || focused;
            const labelY = node.y + r + 14 * scale;
            const iconClass = graphNodeIconClass(node.item.type);
            const circleClass = graphNodeCircleClass(node.item.type, focused);
            const half = glyph / 2;

            return (
              <g
                key={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectItem(node.id);
                }}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectItem(node.id);
                  }
                }}
              >
                <title>{nodeTooltip(node.item)}</title>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={hitR}
                  fill="transparent"
                  pointerEvents="all"
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  className={circleClass}
                  strokeWidth={focused ? 2.5 : 1.5}
                  pointerEvents="none"
                />
                <svg
                  x={node.x - half}
                  y={node.y - half}
                  width={glyph}
                  height={glyph}
                  viewBox="0 0 16 16"
                  className={`pointer-events-none ${iconClass}`}
                  aria-hidden
                >
                  <GraphNodeIconPaths type={node.item.type} />
                </svg>
                {showNodeLabel && (
                  <text
                    x={node.x}
                    y={labelY}
                    textAnchor="middle"
                    className={`pointer-events-none font-sans ${
                      focused
                        ? "fill-emerald-700 text-pds-sm dark:fill-emerald-300"
                        : "fill-pds-muted text-pds-caption"
                    }`}
                    pointerEvents="none"
                  >
                    {preview(node.item.content)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
