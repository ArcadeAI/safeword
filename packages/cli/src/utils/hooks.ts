/**
 * Hook utilities for Claude Code settings
 */

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(child => stable(child));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stable(child)]),
  );
}

function omitOwnedCommandTimeouts(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const entry = value as Record<string, unknown>;
  const withoutTopLevelTimeout = Object.fromEntries(
    Object.entries(entry).filter(([key]) => key !== 'timeout'),
  );
  if (!Array.isArray(entry.hooks)) return withoutTopLevelTimeout;
  return {
    ...withoutTopLevelTimeout,
    hooks: entry.hooks.map(command => {
      if (typeof command !== 'object' || command === null || Array.isArray(command)) return command;
      return Object.fromEntries(
        Object.entries(command as Record<string, unknown>).filter(([key]) => key !== 'timeout'),
      );
    }),
  };
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

function hookIdentity(hook: unknown, omitTimeout = false): string {
  const normalized = normalizeSafewordHookCommands(hook);
  return JSON.stringify(stable(omitTimeout ? omitOwnedCommandTimeouts(normalized) : normalized));
}

function filterHooksByIdentity(
  hooks: unknown[],
  ownedHooks: readonly unknown[],
  omitTimeout: boolean,
): unknown[] {
  const owned = new Set(ownedHooks.map(hook => hookIdentity(hook, omitTimeout)));
  return hooks.filter(hook => !owned.has(hookIdentity(hook, omitTimeout)));
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
  return filterHooksByIdentity(hooks, ownedHooks, false);
}

/** Replace older forms of hooks Safeword currently owns, ignoring timeout drift. */
export function filterOutEquivalentSafewordHooks(
  hooks: unknown[],
  ownedHooks: readonly unknown[],
): unknown[] {
  return filterHooksByIdentity(hooks, ownedHooks, true);
}
