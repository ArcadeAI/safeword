/**
 * Helpers shared by `JsonMergeDefinition.unmerge` implementations.
 */

/**
 * Assign `value` to `target[key]`, or delete the key when `value` has no
 * remaining entries. Unmerge functions strip safeword's managed keys out of a
 * nested object (scripts, hooks, mcpServers, …) and then must either write the
 * trimmed object back or drop the now-empty container entirely. Returns whether
 * the key was kept, so callers can prune sibling keys that only make sense when
 * the container survives (e.g. `.cursor/hooks.json`'s `version`).
 */
export function assignOrPrune(
  target: Record<string, unknown>,
  key: string,
  value: Record<string, unknown>,
): boolean {
  if (Object.keys(value).length > 0) {
    target[key] = value;
    return true;
  }
  Reflect.deleteProperty(target, key);
  return false;
}
