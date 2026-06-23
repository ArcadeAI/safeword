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

// The marker that identifies a frame as safeword-internal across every install
// layout: source dogfood (/…/safeword/packages/cli/…), published
// (/…/node_modules/safeword/dist/…), materialized (/…/.safeword/hooks/…), and
// the plugin cache (/…/plugins/cache/…/safeword/…). All contain the segment
// "safeword". A customer absolute path (/Users/x/secret/app.ts) does not, so it
// is dropped entirely — no path tail leaks.
const SAFEWORD_SEGMENT = 'safeword';

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
 * Keep only safeword-internal stack frames, with the absolute/home prefix
 * stripped (cut at the last "safeword" segment). Customer frames are dropped.
 * Returns cleaned frame strings like `at fn (packages/cli/.../foo.ts:42:10)`.
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

    // Keep the frame only if its location lies inside safeword, and rebuild the
    // path tail from the last "safeword/" segment so no absolute/home prefix
    // survives. Customer locations have no such segment and are dropped whole.
    const markerIndex = location.toLowerCase().lastIndexOf(`${SAFEWORD_SEGMENT}/`);
    if (markerIndex === -1) continue;
    const tail = location.slice(markerIndex + SAFEWORD_SEGMENT.length + 1);

    frames.push(fn ? `at ${fn} (${tail})` : `at ${tail}`);
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

/** One grouped signature with its occurrence count. */
export interface SelfReportGroup {
  signature: string;
  count: number;
  source: string;
  errorClass?: string;
  exitCode?: number;
}

/** Group records by signature (class@source, or cli:source:exit), count desc. */
export function summarizeReports(records: SelfReportRecord[]): SelfReportGroup[] {
  const groups = new Map<string, SelfReportGroup>();
  for (const record of records) {
    const signature = record.errorClass
      ? `${record.errorClass}@${record.source}`
      : `exit${record.exitCode ?? '?'}@${record.source}`;
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
