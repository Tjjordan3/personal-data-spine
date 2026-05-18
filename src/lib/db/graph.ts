import { getItemById } from "./items";
import { getDatabase } from "./database";
import type { LinkType } from "./links";
import type { Item } from "./types";

export interface GraphEdge {
  from: string;
  to: string;
  link_type: LinkType;
}

export interface GraphData {
  nodes: Item[];
  edges: GraphEdge[];
}

interface LinkRow {
  from_id: string;
  to_id: string;
  link_type: string;
}

function buildAdjacency(
  edges: GraphEdge[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const touch = (id: string) => {
    if (!adj.has(id)) adj.set(id, new Set());
  };
  for (const edge of edges) {
    touch(edge.from);
    touch(edge.to);
    adj.get(edge.from)!.add(edge.to);
    adj.get(edge.to)!.add(edge.from);
  }
  return adj;
}

function reachableFrom(start: string, adj: Map<string, Set<string>>): Set<string> {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adj.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** One visual edge per unordered pair (avoids double lines for bidirectional links). */
function dedupeUndirectedEdges(edges: GraphEdge[]): GraphEdge[] {
  const map = new Map<string, GraphEdge>();
  for (const edge of edges) {
    const key = [edge.from, edge.to].sort().join("|");
    if (!map.has(key)) map.set(key, edge);
  }
  return Array.from(map.values());
}

export async function getGraphData(focusId?: string | null): Promise<GraphData> {
  const db = await getDatabase();
  const linkRows = await db.select<LinkRow[]>(
    `SELECT from_id, to_id, link_type FROM item_links ORDER BY created_at DESC LIMIT 500`,
  );

  const allEdges: GraphEdge[] = linkRows.map((row) => ({
    from: row.from_id,
    to: row.to_id,
    link_type: row.link_type as LinkType,
  }));

  if (allEdges.length === 0) {
    return { nodes: [], edges: [] };
  }

  const adj = buildAdjacency(allEdges);

  let visibleIds: Set<string>;
  if (focusId && adj.has(focusId)) {
    visibleIds = reachableFrom(focusId, adj);
  } else {
    visibleIds = new Set(adj.keys());
  }

  const edges = dedupeUndirectedEdges(
    allEdges.filter(
      (e) => visibleIds.has(e.from) && visibleIds.has(e.to),
    ),
  );

  const nodes: Item[] = [];
  for (const id of visibleIds) {
    const item = await getItemById(id);
    if (item) nodes.push(item);
  }

  return { nodes, edges };
}

export function pickDefaultFocusId(
  nodes: Item[],
  edges: GraphEdge[],
): string | null {
  if (nodes.length === 0) return null;
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  let best = nodes[0].id;
  let bestScore = -1;
  for (const node of nodes) {
    const score = degree.get(node.id) ?? 0;
    if (node.type === "meeting") {
      if (score >= bestScore) {
        best = node.id;
        bestScore = score;
      }
    } else if (bestScore < 0 && score > bestScore) {
      best = node.id;
      bestScore = score;
    }
  }
  return best;
}
