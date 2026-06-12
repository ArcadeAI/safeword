/**
 * Structured ticket relations (ticket AKZJXC).
 *
 * One canonical directed edge — `depends_on` — stored as an inline-array scalar
 * the hand-rolled frontmatter parser can hold. The inverse (`blocks`) is always
 * derived across the corpus; cycles and dangling refs surface as warnings, never
 * errors (mirrors safeword's tolerant ID resolution).
 */

/** A ticket reduced to its id and its outgoing `depends_on` edges. */
export interface TicketNode {
  id: string;
  dependsOn: string[];
}

/**
 * Parse a `depends_on` frontmatter scalar into ticket ids. Accepts the inline
 * array form (`[A, B]`) or a bare comma list (`A, B`); trims each id and drops
 * empties. Missing/empty input → `[]`.
 * @param raw the raw frontmatter value, or undefined when the key is absent
 */
export function parseTicketIdList(raw?: string): string[] {
  if (raw === undefined) return [];
  const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '');
  return inner
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

/**
 * Invert the `depends_on` graph into `id → ids that depend on it` (the derived
 * `blocks` edges). Only ids that block something appear as keys; each value
 * preserves corpus order.
 * @param nodes every ticket's id + depends_on edges
 */
export function deriveBlocks(nodes: TicketNode[]): Map<string, string[]> {
  const blocks = new Map<string, string[]>();
  for (const node of nodes) {
    for (const target of node.dependsOn) {
      const blockers = blocks.get(target) ?? [];
      blockers.push(node.id);
      blocks.set(target, blockers);
    }
  }
  return blocks;
}

/**
 * `depends_on` targets absent from the corpus, as `{from, missing}` pairs sorted
 * by from then missing. Warn-only — a target may live on another branch or in
 * completed/.
 * @param nodes every ticket's id + depends_on edges
 */
export function findDanglingDependencies(nodes: TicketNode[]): { from: string; missing: string }[] {
  const known = new Set(nodes.map(node => node.id));
  const dangling: { from: string; missing: string }[] = [];
  for (const node of nodes) {
    for (const target of node.dependsOn) {
      if (!known.has(target)) dangling.push({ from: node.id, missing: target });
    }
  }
  return dangling.toSorted(
    (a, b) => a.from.localeCompare(b.from) || a.missing.localeCompare(b.missing),
  );
}

/**
 * Sorted ids of tickets that participate in any `depends_on` cycle (a node
 * reachable from itself, including a self-edge). Warn-only. Dangling targets are
 * inert — they have no outgoing edges, so they can't form a cycle.
 * @param nodes every ticket's id + depends_on edges
 */
export function findTicketsInCycles(nodes: TicketNode[]): string[] {
  const edges = new Map(nodes.map(node => [node.id, node.dependsOn]));
  const inCycle = new Set<string>();

  for (const start of edges.keys()) {
    // DFS along depends_on edges; reaching `start` again means it's on a cycle.
    const stack = [...(edges.get(start) ?? [])];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const next = stack.pop();
      if (next === undefined) continue;
      if (next === start) {
        inCycle.add(start);
        break;
      }
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...(edges.get(next) ?? []));
    }
  }

  return [...inCycle].toSorted((a, b) => a.localeCompare(b));
}
