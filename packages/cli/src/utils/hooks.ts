/**
 * Hook utilities for Claude Code settings
 */

interface HookCommand {
  type: string;
  command: string;
}

interface HookEntry {
  matcher?: string;
  hooks: HookCommand[];
}

/**
 * Type guard to check if a value is a hook entry with hooks array
 * @param h
 */
function isHookEntry(h: unknown): h is HookEntry {
  return (
    typeof h === 'object' && h !== null && 'hooks' in h && Array.isArray((h as HookEntry).hooks)
  );
}

/**
 * Check if a hook entry contains a safeword hook (command contains '.safeword')
 * @param h
 */
function isSafewordHook(h: unknown): boolean {
  if (!isHookEntry(h)) return false;
  return h.hooks.some(command => typeof command.command === 'string' && command.command.includes('.safeword'));
}

/**
 * Filter out safeword hooks from an array of hook entries
 * @param hooks
 */
export function filterOutSafewordHooks(hooks: unknown[]): unknown[] {
  return hooks.filter(h => !isSafewordHook(h));
}
