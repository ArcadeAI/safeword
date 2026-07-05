/**
 * CLI-side self-observation producer (ticket 5XXQQZ, issues #345 / #720).
 *
 * Captures safeword's own genuine CRASHES — an uncaught exception or unhandled
 * promise rejection thrown out of a command action — into the zero-egress spool,
 * as a sanitized `errorClass` + safeword-internal stack record. Wired into
 * `cli.ts` via `installCliCrashCapture`.
 *
 * NOT captured: deliberate non-zero exits. `check`, `architecture --check`,
 * `codify` (arg validation) and ~a dozen other commands use `process.exit(1)` as
 * normal control flow, and commander exits 1 on arg errors — none are crashes.
 * #720 showed that capturing on `process.on('exit')` for ANY non-zero code
 * floods the spool with these intentional exits. Crash-vs-status is the
 * caught-vs-uncaught distinction, not an exit-code value: a deliberate
 * `process.exit()` never reaches an uncaughtException/unhandledRejection handler.
 *
 * Gated to configured safeword projects only (we never create a spool in an
 * unrelated folder just because the CLI errored there) and best-effort — capture
 * never alters the CLI's own control flow.
 */

import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import {
  detectAgent,
  readSelfReportConfig,
  recordSignal,
} from '../templates/hooks/lib/self-report.js';
import { VERSION } from './version.js';

/**
 * Record a genuine CLI crash as a sanitized signal. Best-effort and gated —
 * mirrors the hook-side crash record shape (source + errorClass + internal
 * stack), never the raw message.
 */
export function recordCliCrash(
  error: unknown,
  argv: string[] = process.argv,
  cwd: string = process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
): void {
  if (!existsSync(nodePath.join(cwd, '.safeword'))) return;
  if (!readSelfReportConfig(cwd).capture) return; // honor selfReport.capture = false

  const thrown = Error.isError(error) ? error : new Error(String(error));
  // argv[2] is the subcommand (e.g. 'check'); the sanitizer bounds it to a safe
  // token, so flags or junk can't smuggle anything into the record.
  const source = argv[2] ?? 'unknown';
  const sessionId = process.env.CLAUDE_SESSION_ID ?? process.env.CLAUDE_CODE_SESSION_ID ?? 'cli';

  recordSignal(
    cwd,
    sessionId,
    { source, agent: detectAgent(), errorClass: thrown.name, stack: thrown.stack },
    VERSION,
  );
}

/**
 * Install the CLI crash backstop: an uncaught exception or unhandled rejection is
 * captured as a sanitized signal, still surfaced to the user (crash UX
 * preserved), then the process exits NON-ZERO — a crash must fail for CI and
 * scripts. This differs from the hook backstop (`installCrashCapture`), which
 * forces exit 0 because a hook must never break the host session.
 */
export function installCliCrashCapture(): void {
  const handler = (reason: unknown): void => {
    recordCliCrash(reason);
    // Preserve the default crash UX: once we register a handler, Node stops
    // printing the error itself, so surface it here before failing non-zero.
    console.error(Error.isError(reason) ? (reason.stack ?? reason.message) : reason);
    process.exit(1);
  };
  process.on('uncaughtException', handler);
  process.on('unhandledRejection', handler);
}
