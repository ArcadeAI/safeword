import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { autoPatchEslintConfig } from './eslint-auto-patch.js';
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
 *   3. the config file's text does NOT already mention `.safeword/` or
 *      `vendoredIgnores`
 *
 * The substring check makes the nudge self-quiescing: once the user applies
 * the snippet (manually following the 153 nudge or via 154's auto-patch),
 * repeat `setup`/`upgrade` runs go quiet.
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
  return !text.includes('.safeword/') && !text.includes('vendoredIgnores');
}

/**
 * Print the nudge using safeword's standard output helpers.
 *
 * Module-internal — callers should use {@link maybePrintVendoredIgnoresNudge}
 * which wraps the decide-then-print sequence.
 */
function printVendoredIgnoresNudge(): void {
  info(
    "\nSafeword vendors hook scripts under .safeword/. Add this line to your existing ESLint config so your lint doesn't flag them:",
  );
  listItem("import safeword from 'safeword/eslint';");
  listItem('// ... your existing configs');
  listItem('...safeword.configs.vendoredIgnores,');
}

export interface AutoPatchOrNudgeOptions extends VendoredIgnoresNudgeOptions {
  /** True if the user passed `--no-modify` to setup/upgrade. Defaults to false. */
  noModify?: boolean;
}

/**
 * Orchestrator for ticket 154: try to auto-patch the consumer's eslint
 * config; on opt-out or bail, fall through to the 153 print-only nudge.
 *
 * Decision tree:
 *   - If `shouldEmitVendoredIgnoresNudge` returns false (no existing
 *     config / non-JS / already handled) → silent.
 *   - Else if `--no-modify` flag OR `SAFEWORD_NO_MODIFY` env var → print
 *     the 153 nudge only (no edit attempted).
 *   - Else attempt auto-patch:
 *       - `patched` → print confirmation with paths
 *       - `idempotent-skip` → silent (defensive — the predicate above
 *         already caught this case)
 *       - `bailed` → print bail line + 153 nudge (caller sees both, the
 *         user knows safeword tried and gets the manual snippet)
 */
export function maybeAutoPatchOrNudge(options: AutoPatchOrNudgeOptions): void {
  if (!shouldEmitVendoredIgnoresNudge(options)) return;
  if (isOptOut(options.noModify ?? false)) {
    printVendoredIgnoresNudge();
    return;
  }
  if (!options.existingEslintConfig) return;
  const configPath = nodePath.join(options.cwd, options.existingEslintConfig);
  const result = autoPatchEslintConfig({ configPath });
  if (result.kind === 'patched') {
    printAutoPatchConfirmation(result.configPath, result.backupPath);
    return;
  }
  if (result.kind === 'idempotent-skip') return;
  printAutoPatchBailLine();
  printVendoredIgnoresNudge();
}

function isOptOut(noModifyFlag: boolean): boolean {
  if (noModifyFlag) return true;
  const envValue = process.env.SAFEWORD_NO_MODIFY;
  return envValue !== undefined && envValue !== '';
}

function printAutoPatchConfirmation(configPath: string, backupPath: string): void {
  info(`\nAdded vendoredIgnores to ${configPath}; backup at ${backupPath}`);
}

function printAutoPatchBailLine(): void {
  info(
    "\nCouldn't auto-patch your eslint config (unrecognized export shape or syntax check failed). Add it manually:",
  );
}
