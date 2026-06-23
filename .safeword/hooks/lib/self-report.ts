// Safeword: self-observation capture core (ticket QYYC5Y, issue #345).
//
// Safeword's hooks swallow their own exceptions (catch -> exit 0) and its CLI
// can exit non-zero — both signals are thrown away today. This module captures
// them as SANITIZED, structured records in a zero-egress local spool so safeword
// can later notice when it is the problem, without ever leaking customer data.
//
// Security model: DENY BY DEFAULT. A record is built only from an allowlist of
// fields. Raw error MESSAGES are never stored (they can carry paths, secrets, or
// file contents). Stack frames are filtered to safeword-internal frames only and
// their absolute/home prefix is stripped. The viewer (read path) does no
// sanitizing because nothing sensitive was ever written.
//
// Self-contained on purpose: imports only node:* so the CLI's `src/` can import
// it (bundled by tsup, like templates/config.ts) AND the hooks can run it under
// bun in a customer repo. No third-party dependencies.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

/** Caller-supplied raw signal. Free-form fields are sanitized before storage. */
export interface SelfReportSignal {
  /** Hook name or CLI command that produced the signal (sanitized to a token). */
  source: string;
  /** Error constructor/name, e.g. 'TypeError'. Sanitized to a bare identifier. */
  errorClass?: string;
  /** Raw `error.stack` string. Frame-filtered to safeword-internal frames only. */
  stack?: string;
  /** Process exit code, for CLI non-zero-exit signals. */
  exitCode?: number;
}

/** The sanitized, persisted record. Allowlisted fields only — no free-form text. */
export interface SelfReportRecord {
  ts: string;
  sessionId: string;
  safewordVersion: string;
  source: string;
  errorClass?: string;
  frames?: string[];
  exitCode?: number;
}

/** Context the caller supplies that isn't part of the raw signal. */
export interface SelfReportContext {
  sessionId: string;
  safewordVersion: string;
}

const SELF_REPORT_DIR = nodePath.join('.safeword', 'self-reports');

// A frame is safeword-internal only when BOTH hold: its path contains a
// separator-bounded segment exactly equal to `safeword` or `.safeword` (NOT a
// substring — `my-safeword/` or `acme-safeword/` must not match), AND the tail
// after that segment begins with a known safeword-internal prefix. The segment
// check drops customer absolute paths; the tail-prefix allowlist additionally
// drops a customer project that merely happens to be named `safeword`. Anything
// else is dropped whole — no prefix, filename, or token-shaped tail can leak.
const SAFEWORD_SEGMENTS = new Set(['safeword', '.safeword']);
const INTERNAL_TAIL_PREFIXES = ['packages/cli/', 'hooks/', 'dist/', 'templates/'];
const MAX_FRAMES = 20;

/** Absolute path of the per-session spool file. */
export function spoolPath(projectDirectory: string, sessionId: string): string {
  return nodePath.join(
    projectDirectory,
    SELF_REPORT_DIR,
    `${sanitizeToken(sessionId) || 'unknown'}.jsonl`,
  );
}

/** Reduce a free-form string to a safe, bounded token. */
function sanitizeToken(value: string): string {
  return value.replaceAll(/[^\w.@-]/g, '').slice(0, 80);
}

/** Reduce an error class to a bare identifier (defends against odd `name`s). */
function sanitizeErrorClass(value: string): string {
  return value.replaceAll(/[^\w$]/g, '').slice(0, 80);
}

/**
 * If `location` lies inside safeword, return its internal tail (path relative to
 * the safeword install, with the absolute/home prefix stripped). Otherwise
 * undefined. Separator-bounded segment match (`/` and `\`) + internal-prefix
 * allowlist — see SAFEWORD_SEGMENTS / INTERNAL_TAIL_PREFIXES. Tries safeword
 * segments from last to first so the most specific (e.g. materialized
 * `.safeword/hooks/…`) wins.
 */
function safewordInternalTail(location: string): string | undefined {
  const segments = location.split(/[/\\]/);
  for (let index = segments.length - 1; index >= 0; index--) {
    const segment = segments[index];
    if (segment === undefined || !SAFEWORD_SEGMENTS.has(segment)) continue;
    const tail = segments.slice(index + 1).join('/');
    if (INTERNAL_TAIL_PREFIXES.some(prefix => tail.startsWith(prefix))) return tail;
  }
  return undefined;
}

/**
 * Keep only safeword-internal stack frames, with the absolute/home prefix
 * stripped. Customer frames — including those under a path that merely contains
 * "safeword" as a substring or a customer repo named "safeword" — are dropped.
 * Returns cleaned frame strings like `at fn (packages/cli/.../foo.ts:42:10)`,
 * capped at MAX_FRAMES.
 */
export function sanitizeStackFrames(stack: string | undefined): string[] {
  if (!stack) return [];
  const frames: string[] = [];
  for (const rawLine of stack.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('at ')) continue;

    // Split a frame into its function label and its location. Two shapes:
    //   `at <fn> (<path>:line:col)`  and  `at <path>:line:col` (no function).
    const rest = line.slice('at '.length);
    let fn = '';
    let location: string;
    const openParen = rest.indexOf('(');
    if (openParen !== -1 && rest.endsWith(')')) {
      fn = rest.slice(0, openParen).trim();
      location = rest.slice(openParen + 1, -1);
    } else {
      location = rest.trim();
    }

    const tail = safewordInternalTail(location);
    if (tail === undefined) continue;

    frames.push(fn ? `at ${fn} (${tail})` : `at ${tail}`);
    if (frames.length >= MAX_FRAMES) break;
  }
  return frames;
}

/** Build a sanitized record from a raw signal + context. Allowlist only. */
export function buildRecord(signal: SelfReportSignal, ctx: SelfReportContext): SelfReportRecord {
  const record: SelfReportRecord = {
    ts: new Date().toISOString(),
    sessionId: sanitizeToken(ctx.sessionId) || 'unknown',
    safewordVersion: sanitizeToken(ctx.safewordVersion) || 'unknown',
    source: sanitizeToken(signal.source) || 'unknown',
  };

  if (signal.errorClass) {
    const cls = sanitizeErrorClass(signal.errorClass);
    if (cls) record.errorClass = cls;
  }

  const frames = sanitizeStackFrames(signal.stack);
  if (frames.length > 0) record.frames = frames;

  if (typeof signal.exitCode === 'number' && Number.isFinite(signal.exitCode)) {
    record.exitCode = Math.trunc(signal.exitCode);
  }

  return record;
}

/**
 * Capture a signal: build the sanitized record and append it to the session
 * spool. BEST-EFFORT — never throws and never alters the caller's control flow.
 */
export function recordSignal(
  projectDirectory: string,
  sessionId: string,
  signal: SelfReportSignal,
  safewordVersion: string,
): void {
  try {
    const record = buildRecord(signal, { sessionId, safewordVersion });
    const file = spoolPath(projectDirectory, sessionId);
    mkdirSync(nodePath.dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(record)}\n`);
  } catch {
    // Self-observation must never break the host. Swallow.
  }
}

/** Best-effort read of the installed safeword version (`.safeword/version`). */
function readInstalledVersion(projectDirectory: string): string {
  try {
    return (
      readFileSync(nodePath.join(projectDirectory, '.safeword', 'version'), 'utf8').trim() ||
      'unknown'
    );
  } catch {
    return 'unknown';
  }
}

/**
 * Install a crash backstop for a hook: an UNCAUGHT exception or rejection is
 * captured as a sanitized signal, then the hook exits 0 — preserving safeword's
 * swallow-and-continue contract (a hook must never break the host session) while
 * no longer throwing the bug signal away. Expected, explicitly-caught conditions
 * (no stdin, no git) never reach here, so this only fires on genuine bugs.
 */
export function installCrashCapture(
  hookName: string,
  projectDirectory: string = process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
): void {
  const handler = (reason: unknown): void => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    const sessionId = process.env.CLAUDE_SESSION_ID ?? process.env.CLAUDE_CODE_SESSION_ID ?? 'hook';
    recordSignal(
      projectDirectory,
      sessionId,
      { source: hookName, errorClass: error.name, stack: error.stack },
      readInstalledVersion(projectDirectory),
    );
    process.exit(0);
  };
  process.on('uncaughtException', handler);
  process.on('unhandledRejection', handler);
}

/** Parse one spool file into records, skipping blank/malformed lines. */
function parseSpoolFile(filePath: string): SelfReportRecord[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  const records: SelfReportRecord[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed) as SelfReportRecord);
    } catch {
      // Skip malformed line.
    }
  }
  return records;
}

/** Read all records from every session spool file. Skips malformed lines. */
export function readReports(projectDirectory: string): SelfReportRecord[] {
  const dir = nodePath.join(projectDirectory, SELF_REPORT_DIR);
  if (!existsSync(dir)) return [];
  let files: string[];
  try {
    files = readdirSync(dir).filter(name => name.endsWith('.jsonl'));
  } catch {
    return [];
  }
  return files.flatMap(name => parseSpoolFile(nodePath.join(dir, name)));
}

/** Read only the records captured for one session (its single spool file). */
export function readSessionReports(
  projectDirectory: string,
  sessionId: string,
): SelfReportRecord[] {
  return parseSpoolFile(spoolPath(projectDirectory, sessionId));
}

/** One grouped signature with its occurrence count. */
export interface SelfReportGroup {
  signature: string;
  count: number;
  source: string;
  errorClass?: string;
  exitCode?: number;
}

/** Stable signature for a record — the dedup key (class@source, or exitN@source). */
export function signatureOf(record: SelfReportRecord): string {
  return record.errorClass
    ? `${record.errorClass}@${record.source}`
    : `exit${record.exitCode ?? '?'}@${record.source}`;
}

/** Group records by signature (class@source, or cli:source:exit), count desc. */
export function summarizeReports(records: SelfReportRecord[]): SelfReportGroup[] {
  const groups = new Map<string, SelfReportGroup>();
  for (const record of records) {
    const signature = signatureOf(record);
    const existing = groups.get(signature);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(signature, {
        signature,
        count: 1,
        source: record.source,
        errorClass: record.errorClass,
        exitCode: record.exitCode,
      });
    }
  }
  return groups
    .values()
    .toArray()
    .toSorted((a, b) => b.count - a.count);
}

/** A ready-to-file GitHub issue draft for one self-report signature. */
export interface SelfReportIssueDraft {
  signature: string;
  title: string;
  body: string;
  labels: string[];
}

/**
 * Build a sanitized, ready-to-file issue draft per signature. The agent's job is
 * only transport: search for an open issue with the title, then comment-or-create.
 * The body is assembled from ALLOWLISTED record fields only — the same fields the
 * capture sanitizer permits — so no customer data can reach a public issue here.
 */
export function formatIssueDrafts(records: SelfReportRecord[]): SelfReportIssueDraft[] {
  return summarizeReports(records).map(group => {
    const matching = records.filter(record => signatureOf(record) === group.signature);
    const versions = [...new Set(matching.map(record => record.safewordVersion))].sort();
    const frames = matching.find(record => record.frames?.length)?.frames ?? [];

    const lines = [
      'Safeword self-reported this signal from its own runtime — a bug or rough edge in safeword, not in the host project.',
      '',
      `- **Signature:** \`${group.signature}\``,
      `- **Occurrences this report:** ${group.count}`,
      `- **Source:** \`${group.source}\``,
      group.errorClass
        ? `- **Error class:** \`${group.errorClass}\``
        : `- **Exit code:** ${group.exitCode ?? 'unknown'}`,
      `- **Safeword version(s):** ${versions.join(', ') || 'unknown'}`,
      '',
      frames.length > 0
        ? ['**Stack (safeword-internal frames only):**', '```', ...frames, '```'].join('\n')
        : '_No stack frames captured (CLI-exit signal)._',
      '',
      '<sub>Auto-drafted by `safeword self-report --format issue`; sanitized at capture (allowlist-only, no customer data).</sub>',
    ];

    return {
      signature: group.signature,
      title: `[self-report] ${group.signature}`,
      body: lines.join('\n'),
      labels: ['self-reported'],
    };
  });
}

/**
 * Build the Stop-time surfacing line for a session's records, or null when there
 * is nothing to surface. Phrased as a FACTUAL statement (no imperative / no
 * out-of-band command) so Claude treats it as context rather than tripping its
 * prompt-injection defenses (https://code.claude.com/docs/en/hooks).
 */
export function formatSelfReportSurfacing(records: SelfReportRecord[]): string | undefined {
  if (records.length === 0) return undefined;
  const breakdown = summarizeReports(records)
    .map(group => `${group.signature} (×${group.count})`)
    .join(', ');
  return (
    `Safeword recorded ${records.length} of its own internal signal(s) this session: ${breakdown}. ` +
    'These are safeword bugs or rough edges, not your edits; run `safeword self-report` to inspect them.'
  );
}
