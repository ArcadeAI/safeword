/**
 * Hook utilities for Claude Code settings
 */

interface HookCommand {
  type?: string;
  command: string;
}

interface HookEntry {
  matcher?: string;
  hooks: HookCommand[];
}

interface CursorHookEntry {
  command: string;
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

function isCursorHookEntry(h: unknown): h is CursorHookEntry {
  return typeof h === 'object' && h !== null && typeof (h as CursorHookEntry).command === 'string';
}

/**
 * Check if a hook entry contains a safeword hook (command contains '.safeword')
 * @param h
 */
function isSafewordHook(h: unknown): boolean {
  if (isCursorHookEntry(h)) return h.command.includes('.safeword');
  if (!isHookEntry(h)) return false;
  return h.hooks.some(command => command.command.includes('.safeword'));
}

/**
 * Filter out safeword hooks from an array of hook entries
 * @param hooks
 */
export function filterOutSafewordHooks(hooks: unknown[]): unknown[] {
  return hooks.filter(h => !isSafewordHook(h));
}
