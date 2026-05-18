import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  getGraphData,
  pickDefaultFocusId,
  type GraphEdge,
} from "../lib/db/graph";
import { linkTypeLabel } from "../lib/db/links";
import type { Item } from "../lib/db/types";

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

const WIDTH = 640;
const HEIGHT = 360;

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
): LayoutNode[] {
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
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
          layout.push({ id: node.id, item: node, x: cx, y: cy - 40 });
        }
      }
      continue;
    }

    const radius = 70 + depth * 55;
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

function preview(content: string, max = 24): string {
  const line = content.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

export function GraphView({ focusId, onSelectItem }: GraphViewProps) {
  const [nodes, setNodes] = useState<Item[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);

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

  const effectiveFocus =
    focusId && nodes.some((n) => n.id === focusId)
      ? focusId
      : pickDefaultFocusId(nodes, edges);

  const layout = useMemo(() => {
    if (!effectiveFocus || nodes.length === 0) return [];
    return computeLayout(nodes, edges, effectiveFocus);
  }, [nodes, edges, effectiveFocus]);

  const positions = useMemo(
    () => new Map(layout.map((n) => [n.id, n])),
    [layout],
  );

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-pds-border text-sm text-pds-muted">
        Loading graph…
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-pds-border text-sm text-pds-muted">
        No links to visualize yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-pds-border bg-pds-input/50 p-2">
      <p className="mb-2 text-[11px] text-pds-muted">
        {effectiveFocus
          ? `Neighborhood of selected item · ${nodes.length} node(s)`
          : "Link graph · click a node to focus"}
      </p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-64 w-full">
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
              stroke="#52525b"
              strokeWidth={1.5}
            >
              <title>{linkTypeLabel(edge.link_type)}</title>
            </line>
          );
        })}
        {layout.map((node) => {
          const focused = node.id === effectiveFocus;
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
              <circle
                cx={node.x}
                cy={node.y}
                r={22}
                fill="transparent"
                pointerEvents="all"
              />
              <circle
                cx={node.x}
                cy={node.y}
                r={focused ? 14 : 10}
                fill={focused ? "#7c3aed" : "#3f3f46"}
                stroke={focused ? "#a78bfa" : "#71717a"}
                strokeWidth={focused ? 2 : 1}
                pointerEvents="none"
              />
              <text
                x={node.x}
                y={node.y + 26}
                textAnchor="middle"
                fill={focused ? "#c4b5fd" : "#a1a1aa"}
                fontSize="9"
                pointerEvents="none"
              >
                {node.item.type}
              </text>
              <text
                x={node.x}
                y={node.y + 38}
                textAnchor="middle"
                fill="#71717a"
                fontSize="8"
                pointerEvents="none"
              >
                {preview(node.item.content)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
