/**
 * CLI-side self-observation producer (ticket QYYC5Y, issue #345).
 *
 * Captures safeword's own non-zero CLI exits into the zero-egress spool. Wired
 * into `cli.ts` via `process.on('exit')` so any command that exits non-zero —
 * an internal crash, an unknown subcommand — leaves a sanitized signal behind.
 *
 * Gated to configured safeword projects only: we never create a spool directory
 * in an unrelated folder just because the CLI happened to error there.
 */

import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { readSelfReportConfig, recordSignal } from '../templates/hooks/lib/self-report.js';
import { VERSION } from './version.js';

export function recordCliExit(
  code: number,
  argv: string[] = process.argv,
  cwd: string = process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
): void {
  if (!code) return; // 0 / undefined — clean exit, nothing to report
  if (!existsSync(nodePath.join(cwd, '.safeword'))) return;
  if (!readSelfReportConfig(cwd).capture) return; // honor selfReport.capture = false

  // argv[2] is the subcommand (e.g. 'check'); the sanitizer bounds it to a safe
  // token, so flags or junk can't smuggle anything into the record.
  const source = argv[2] ?? 'unknown';
  const sessionId = process.env.CLAUDE_SESSION_ID ?? process.env.CLAUDE_CODE_SESSION_ID ?? 'cli';

  recordSignal(cwd, sessionId, { source, exitCode: code }, VERSION);
}
