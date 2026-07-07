/**
 * Hook-manager world detection (ZJMZ50, #810 child 2).
 */

export type HookManagerWorld = 'husky' | 'husky-uninitialized' | 'lefthook' | 'pre-commit' | 'bare';

/** Which hook-manager world governs this host's git hooks. */
export function detectHookManagerWorld(
  _cwd: string,
  _allDependencies: Record<string, string>,
): HookManagerWorld {
  return 'bare';
}
