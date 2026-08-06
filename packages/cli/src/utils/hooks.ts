/**
 * Hook utilities for Claude Code settings
 */

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(child => stable(child));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'timeout')
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stable(child)]),
  );
}

export function normalizeSafewordHookCommands(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(child => normalizeSafewordHookCommands(child));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (key !== 'command' || typeof child !== 'string') {
        return [key, normalizeSafewordHookCommands(child)];
      }
      for (const executable of ['bun', 'bash']) {
        for (const relative of ['.safeword/hooks/', './.safeword/hooks/']) {
          const prefix = `${executable} ${relative}`;
          if (child.startsWith(prefix)) {
            return [
              key,
              `${executable} "$CLAUDE_PROJECT_DIR"/.safeword/hooks/${child.slice(prefix.length)}`,
            ];
          }
        }
      }
      return [key, child];
    }),
  );
}

function hookIdentity(hook: unknown): string {
  const normalized = normalizeSafewordHookCommands(hook);
  return JSON.stringify(stable(normalized));
}

/**
 * Filter only exact Safeword-owned hook entries from an array. Callers provide
 * the entries they own; paths and command substrings are never deletion proof.
 * @param hooks
 * @param ownedHooks
 */
export function filterOutSafewordHooks(
  hooks: unknown[],
  ownedHooks: readonly unknown[],
): unknown[] {
  const owned = new Set(ownedHooks.map(hook => hookIdentity(hook)));
  return hooks.filter(hook => !owned.has(hookIdentity(hook)));
}
