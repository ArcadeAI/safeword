import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { info, listItem } from './output.js';

export interface VendoredIgnoresNudgeOptions {
  cwd: string;
  /** Path (relative to cwd) of the consumer's existing ESLint config, or undefined if none. */
  existingEslintConfig: string | undefined;
  /** True if the project has JavaScript/TypeScript sources safeword can lint. */
  hasJavaScript: boolean;
}

/**
 * Decide whether to print the install-time nudge telling the user to add
 * `...safeword.configs.vendoredIgnores` to their existing eslint config.
 *
 * Emits iff:
 *   1. an existing eslint config is detected, AND
 *   2. the project has JavaScript, AND
 *   3. the config file's text does NOT already mention `.safeword/`
 *
 * The substring check makes the nudge self-quiescing: once the user applies
 * the snippet (or independently adds `.safeword/` to their ignores), repeat
 * `setup`/`upgrade` runs go quiet.
 */
export function shouldEmitVendoredIgnoresNudge(options: VendoredIgnoresNudgeOptions): boolean {
  const { cwd, existingEslintConfig, hasJavaScript } = options;
  if (!hasJavaScript) return false;
  if (!existingEslintConfig) return false;
  const fullPath = nodePath.join(cwd, existingEslintConfig);
  let text: string;
  try {
    text = readFileSync(fullPath, 'utf8');
  } catch {
    return true;
  }
  return !text.includes('.safeword/');
}

/**
 * Print the nudge using safeword's standard output helpers.
 *
 * Called by `safeword setup` and `safeword upgrade` when
 * {@link shouldEmitVendoredIgnoresNudge} returns true.
 */
export function printVendoredIgnoresNudge(): void {
  info(
    "\nSafeword vendors hook scripts under .safeword/. Add this line to your existing ESLint config so your lint doesn't flag them:",
  );
  listItem("import safeword from 'safeword/eslint';");
  listItem('// ... your existing configs');
  listItem('...safeword.configs.vendoredIgnores,');
}

/**
 * Convenience wrapper: decide-then-print. Lets callers (setup/upgrade) keep
 * a single unconditional call site, so the branching lives here rather than
 * inflating orchestrator complexity.
 */
export function maybePrintVendoredIgnoresNudge(options: VendoredIgnoresNudgeOptions): void {
  if (shouldEmitVendoredIgnoresNudge(options)) {
    printVendoredIgnoresNudge();
  }
}
