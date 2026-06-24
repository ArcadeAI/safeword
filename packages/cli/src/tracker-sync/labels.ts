/**
 * Label reconciliation for re-sync (JS5K5G AC7 — field ownership over labels).
 * `gh issue edit --add-label` only *adds*, so without this a changed `epic:`/
 * `type:` would leave the stale label behind and corrupt the board grouping that
 * is v1's whole point. safeword owns only the `epic:`/`type:` namespaces — human
 * labels are never touched. Pure function so the logic is unit-tested even though
 * the surrounding `gh` read/write is the untested live-I/O shim.
 */

/** Label namespaces safeword owns and may remove; everything else is the team's. */
export const OWNED_LABEL_PREFIXES = ['epic:', 'type:'];

function isOwned(label: string): boolean {
  return OWNED_LABEL_PREFIXES.some(prefix => label.startsWith(prefix));
}

/**
 * Given an issue's current labels and the desired safeword-owned set, return the
 * labels to add and remove. Only owned labels are ever removed; human labels and
 * already-correct owned labels are left in place.
 */
export function reconcileOwnedLabels(
  current: string[],
  desired: string[],
): { add: string[]; remove: string[] } {
  const desiredSet = new Set(desired);
  const currentSet = new Set(current);
  return {
    add: desired.filter(label => !currentSet.has(label)),
    remove: current.filter(label => isOwned(label) && !desiredSet.has(label)),
  };
}
