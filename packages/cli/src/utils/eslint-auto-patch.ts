/**
 * Auto-patch a downstream project's flat ESLint config to spread
 * `safeword.configs.vendoredIgnores`. Used by `safeword setup` and
 * `safeword upgrade` (ticket 154).
 *
 * Textual insertion, not AST — the heuristic handles the common shapes
 * (bare array literal + `defineConfig(...)` wrapper). Anything else
 * (function-returning-config, single-imported-config, unrecognized
 * wrapper) bails out so the caller can fall back to ticket 153's
 * print-only nudge.
 *
 * Safety:
 * - `.safeword-bak` written before any edit
 * - `node --check` validates JS variants (.mjs/.js/.cjs); failure
 *   restores the backup and bails
 * - TS variants (.ts/.mts/.cts) skip syntax check — node can't parse
 *   TS, and pulling in a TS-aware checker would balloon dep weight for
 *   a one-line insert
 *
 * Idempotency by substring: any config text containing
 * `vendoredIgnores` is treated as already-patched (covers both prior
 * auto-patch and manual application of the 153 print-nudge).
 */

import { execSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

const VENDORED_MARKER = 'vendoredIgnores';
const ESM_IMPORT = "import safeword from 'safeword/eslint';";
const CJS_IMPORT = "const safeword = require('safeword/eslint');";
const SPREAD = '...safeword.configs.vendoredIgnores,';
const BACKUP_SUFFIX = '.safeword-bak';
const TS_EXTENSIONS = new Set(['.ts', '.mts', '.cts']);
const CJS_EXTENSIONS = new Set(['.cjs']);

export interface AutoPatchOptions {
  /** Path (absolute or relative to cwd) of the flat ESLint config to patch. */
  configPath: string;
}

export type AutoPatchResult =
  | { kind: 'patched'; configPath: string; backupPath: string }
  | { kind: 'idempotent-skip' }
  | { kind: 'bailed'; reason: BailReason };

type BailReason = 'read-failed' | 'unrecognized-shape' | 'syntax-check-failed' | 'write-failed';

/**
 * Walk a string starting at an opening `[` and return the index of the
 * matching `]`. Returns -1 if no match (unbalanced) or if any string /
 * comment is unterminated. Tracks single/double/backtick strings and
 * `//` + `/* * /` comments so brackets inside literals don't fool the
 * walker.
 */
function findMatchingBracket(source: string, openIndex: number): number {
  if (source[openIndex] !== '[') return -1;
  let depth = 1;
  let i = openIndex + 1;
  while (i < source.length) {
    const after = skipNonContent(source, i);
    if (after === -1) return -1;
    if (after > i) {
      i = after;
      continue;
    }
    const ch = source[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

/**
 * If `source[i]` starts a comment or string literal, return the index just
 * past its end. Otherwise return `i` unchanged. Returns -1 if a comment or
 * string is unterminated.
 */
function skipNonContent(source: string, i: number): number {
  const ch = source[i];
  const next = source[i + 1];
  if (ch === '/' && next === '/') {
    const nl = source.indexOf('\n', i);
    return nl === -1 ? -1 : nl + 1;
  }
  if (ch === '/' && next === '*') {
    const close = source.indexOf('*/', i + 2);
    return close === -1 ? -1 : close + 2;
  }
  if (ch === "'" || ch === '"' || ch === '`') {
    return skipStringLiteral(source, i);
  }
  return i;
}

function skipStringLiteral(source: string, startIndex: number): number {
  const quote = source[startIndex];
  let i = startIndex + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    i += 1;
  }
  return -1;
}

/**
 * Find the position of the closing `]` of the default-export config array.
 *
 * Recognized shapes:
 *   - `export default [...]` (ESM, bare array)
 *   - `export default defineConfig([...])` (ESM, wrapper)
 *   - `module.exports = [...]` (CJS, bare array)
 *   - `module.exports = defineConfig([...])` (CJS, wrapper)
 *
 * Returns -1 on any unrecognized shape (function-returning-config,
 * single-imported-config, unknown wrapper).
 */
function findDefaultExportArrayClose(source: string): number {
  const esmResult = findArrayCloseAfter(source, 'export default', false);
  if (esmResult !== -1) return esmResult;
  return findArrayCloseAfter(source, 'module.exports', true);
}

function skipWhitespace(source: string, start: number): number {
  let i = start;
  while (i < source.length && /\s/.test(source[i] ?? '')) i += 1;
  return i;
}

/**
 * Walk backward from `start` over whitespace, returning the index of the
 * last non-whitespace char. -1 if the entire prefix is whitespace.
 */
function lastNonWhitespaceIndex(source: string, start: number): number {
  let i = start;
  while (i >= 0 && /\s/.test(source[i] ?? '')) i -= 1;
  return i;
}

function findArrayCloseAfter(source: string, marker: string, requireEquals: boolean): number {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return -1;
  let cursor = skipWhitespace(source, markerIndex + marker.length);
  if (requireEquals) {
    if (source[cursor] !== '=') return -1;
    cursor = skipWhitespace(source, cursor + 1);
  }
  if (source[cursor] === '[') return findMatchingBracket(source, cursor);
  if (source.startsWith('defineConfig', cursor)) {
    return findDefineConfigArrayClose(source, cursor);
  }
  return -1;
}

function findDefineConfigArrayClose(source: string, defineStart: number): number {
  const paren = skipWhitespace(source, defineStart + 'defineConfig'.length);
  if (source[paren] !== '(') return -1;
  const inner = skipWhitespace(source, paren + 1);
  if (source[inner] !== '[') return -1;
  return findMatchingBracket(source, inner);
}

/**
 * Insert the safeword import after the last existing import/require line,
 * or at the very top if there are none. Uses ESM `import` syntax for
 * `.mjs/.js/.ts/.mts/.cts`, CJS `require` syntax for `.cjs`.
 */
function ensureSafewordImport(source: string, eol: string, isCjs: boolean): string {
  const importLine = isCjs ? CJS_IMPORT : ESM_IMPORT;
  if (source.includes(importLine) || source.includes("from 'safeword/eslint'")) return source;
  const importLineRegex = isCjs
    ? /^(?:const|let|var)\s.+?=\s*require\s*\(.+?\);[ \t]*\r?$/gm
    : /^import\s.+?;[ \t]*\r?$/gm;
  let lastImportEnd = -1;
  for (const match of source.matchAll(importLineRegex)) {
    lastImportEnd = (match.index ?? 0) + match[0].length;
  }
  if (lastImportEnd === -1) {
    return importLine + eol + source;
  }
  return source.slice(0, lastImportEnd) + eol + importLine + source.slice(lastImportEnd);
}

function detectEol(source: string): string {
  return source.includes('\r\n') ? '\r\n' : '\n';
}

function isTypeScriptConfig(configPath: string): boolean {
  return TS_EXTENSIONS.has(nodePath.extname(configPath));
}

function isCjsConfig(configPath: string): boolean {
  return CJS_EXTENSIONS.has(nodePath.extname(configPath));
}

/**
 * Main entry point. See module docstring for behavior contract.
 */
export function autoPatchEslintConfig(options: AutoPatchOptions): AutoPatchResult {
  const { configPath } = options;

  let source: string;
  try {
    source = readFileSync(configPath, 'utf8');
  } catch {
    return { kind: 'bailed', reason: 'read-failed' };
  }

  if (source.includes(VENDORED_MARKER)) {
    return { kind: 'idempotent-skip' };
  }

  const closeIndex = findDefaultExportArrayClose(source);
  if (closeIndex === -1) {
    return { kind: 'bailed', reason: 'unrecognized-shape' };
  }

  const eol = detectEol(source);
  const sourceWithImport = ensureSafewordImport(source, eol, isCjsConfig(configPath));
  // closeIndex was computed on `source`; if `ensureSafewordImport` prepended
  // content, recompute on the new text. Either way it's idempotent and cheap.
  const finalClose = findDefaultExportArrayClose(sourceWithImport);
  if (finalClose === -1) {
    // Shouldn't happen — we just verified the shape — but bail defensively.
    return { kind: 'bailed', reason: 'unrecognized-shape' };
  }

  // Decide whether we need a leading comma. Walk backward from the
  // closing `]`, skipping whitespace; if the last non-whitespace char is
  // `[` (empty array) or `,` (trailing-comma style) no comma is needed.
  // Otherwise the last element lacks a trailing comma and we must add
  // one before our spread.
  const probe = lastNonWhitespaceIndex(sourceWithImport, finalClose - 1);
  const charBefore = sourceWithImport[probe];
  const isNeedsLeadingComma = charBefore !== '[' && charBefore !== ',';

  const before = sourceWithImport.slice(0, finalClose);
  const after = sourceWithImport.slice(finalClose);
  const prefix = `${isNeedsLeadingComma ? ',' : ''}${eol}  `;
  const patched = `${before}${prefix}${SPREAD}${eol}${after}`;

  const writeResult = writeAndValidate(configPath, patched, !isTypeScriptConfig(configPath));
  if (!writeResult.ok) return { kind: 'bailed', reason: writeResult.reason };
  return { kind: 'patched', configPath, backupPath: writeResult.backupPath };
}

function writeAndValidate(
  configPath: string,
  patched: string,
  runSyntaxCheck: boolean,
):
  | { ok: true; backupPath: string }
  | { ok: false; reason: 'write-failed' | 'syntax-check-failed' } {
  const backupPath = `${configPath}${BACKUP_SUFFIX}`;
  try {
    copyFileSync(configPath, backupPath);
    writeFileSync(configPath, patched, 'utf8');
  } catch {
    return { ok: false, reason: 'write-failed' };
  }
  if (!runSyntaxCheck) return { ok: true, backupPath };
  try {
    execSync(`node --check "${configPath}"`, { stdio: 'pipe' });
    return { ok: true, backupPath };
  } catch {
    // Revert so the user's config is byte-identical to its pre-command state.
    try {
      copyFileSync(backupPath, configPath);
    } catch {
      // Best-effort revert; if this fails the backup is still on disk.
    }
    return { ok: false, reason: 'syntax-check-failed' };
  }
}
