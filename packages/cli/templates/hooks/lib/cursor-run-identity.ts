import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { resolveNamespaceRoot } from './namespace-root.js';
import { commandWords, splitShellSegments } from './shell-segments.js';

const CURSOR_RUN_IDENTITY_CACHE = 'cursor-run-identity.json';
const CODEX_RUN_IDENTITY_CACHE = 'codex-run-identity.json';

// write-review-stamp.ts bridges use their own cache files (#630): the record-
// skill-invocation cache is single-slot and deleted on read, so a chained
// `record-skill-invocation && write-review-stamp` command would starve one
// consumer if they shared a file.
const CURSOR_REVIEW_STAMP_IDENTITY_CACHE = 'cursor-review-stamp-identity.json';
const CODEX_REVIEW_STAMP_IDENTITY_CACHE = 'codex-review-stamp-identity.json';

/** Fixed cache key for the stamp-helper bridge — not a skill, so not skill-named. */
const REVIEW_STAMP_CACHE_KEY = 'review-stamp';
const FAILURE_NOTICE = '[skill-invocation-log] FAILED - no current-run proof logged';

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

interface ShellRunIdentityCache {
  entries: ShellRunIdentityEntry[];
}

interface ShellRunIdentityEntry {
  id: string;
  skillName: string;
  recordedAt: string;
}

interface RememberShellRunIdentityInput {
  projectDirectory: string;
  cacheFile: string;
  id: string | undefined;
  skillNames: string[];
  now?: Date;
}

interface ReadFreshShellRunIdentityInput {
  projectDirectory: string;
  cacheFile: string;
  skillName: string;
  now?: Date;
  maxAgeMs?: number;
}

interface RememberCursorRunIdentityInput {
  projectDirectory: string;
  conversationId: string | undefined;
  skillNames: string[];
  now?: Date;
}

interface RememberCodexRunIdentityInput {
  projectDirectory: string;
  sessionId: string | undefined;
  skillNames: string[];
  now?: Date;
}

interface ReadFreshRunIdentityInput {
  projectDirectory: string;
  skillName: string;
  now?: Date;
  maxAgeMs?: number;
}

const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function nonEmptyString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function cachePathForProject(projectDirectory: string, cacheFile: string): string {
  return nodePath.join(resolveNamespaceRoot(projectDirectory), cacheFile);
}

function isBunExecutable(token: string | undefined): boolean {
  if (token === undefined) return false;
  return nodePath.basename(token) === 'bun';
}

function isInvocationHelperPath(token: string | undefined): boolean {
  if (token === undefined) return false;
  const normalized = token.replaceAll('\\', '/');
  return (
    normalized === '.safeword/hooks/record-skill-invocation.ts' ||
    normalized.endsWith('/.safeword/hooks/record-skill-invocation.ts')
  );
}

// Unlike the invocation-helper matcher (slash-anchored suffix only), the stamp
// helper is documented in BOTH forms: `$PROJECT_DIR`-absolute (the self-review
// fallback) and bare-relative (`bun .safeword/hooks/write-review-stamp.ts …`,
// the skip valve and the Tier-2 phase stamp). Accept the exact relative form or
// the slash-anchored suffix; `foo.safeword/…` still never matches.
function isReviewStampHelperPath(token: string | undefined): boolean {
  if (token === undefined) return false;
  const normalized = token.replaceAll('\\', '/');
  return (
    normalized === '.safeword/hooks/write-review-stamp.ts' ||
    normalized.endsWith('/.safeword/hooks/write-review-stamp.ts')
  );
}

export function parseRecordSkillInvocationCommand(
  command: string,
): { skillName: string } | undefined {
  // Tokenization is the shared shell-segments tokenizer (EDDABK follow-up), so
  // execution prefixes (`command`, `env` + flags, `VAR=val`, corepack, subshell
  // openers) are skipped before the bun word — a prefixed helper invocation
  // still records its proof.
  for (const segment of splitShellSegments(command)) {
    const words = commandWords(segment);

    if (!isBunExecutable(words[0])) continue;
    if (!isInvocationHelperPath(words[1])) continue;

    const skillName = nonEmptyString(words[3]);
    if (skillName !== undefined && SKILL_NAME_PATTERN.test(skillName)) {
      return { skillName };
    }
  }

  return undefined;
}

function isTrustedInvocationPath(input: {
  helperPath: string | undefined;
  projectArgument: string | undefined;
  projectDirectory: string;
  trustedProjectDirectoryVariables: ReadonlySet<string>;
}): boolean {
  const { helperPath, projectArgument, projectDirectory, trustedProjectDirectoryVariables } = input;
  if (helperPath === undefined || projectArgument === undefined) return false;

  const normalizedHelper = normalizeComparablePath(helperPath);
  const normalizedProject = normalizeComparablePath(projectDirectory);
  const expectedHelper = `${normalizedProject}/.safeword/hooks/record-skill-invocation.ts`;
  const relativeHelper = '.safeword/hooks/record-skill-invocation.ts';
  if (normalizedHelper === relativeHelper || normalizedHelper === expectedHelper) {
    return normalizeComparablePath(projectArgument) === normalizedProject;
  }

  return [...trustedProjectDirectoryVariables].some(variable => {
    const helperForVariable = `${variable}/.safeword/hooks/record-skill-invocation.ts`;
    return normalizedHelper === helperForVariable && projectArgument === variable;
  });
}

// macOS commonly exposes the same checkout through both `/var/...` and its
// physical `/private/var/...` path. Cursor's `chdir` reports the latter while
// a documented command can retain the former. Resolve only absolute existing
// paths, keeping the exact relative and `$PROJECT_DIR` forms as explicit
// allow-list entries rather than broadening helper recognition.
function normalizeComparablePath(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/\/+$/, '');
  if (!nodePath.isAbsolute(normalized)) return normalized;

  try {
    return realpathSync.native(normalized).replaceAll('\\', '/').replace(/\/+$/, '');
  } catch {
    return normalized;
  }
}

function hasDocumentedProjectDirectoryPrelude(segment: string): boolean {
  // Every proof skill emits this exact root resolver. It is the only shell
  // assignment form we can establish as same-project before the shell executes:
  // it resolves the inherited project root, then the current Git worktree, then
  // the current directory. Arbitrary PROJECT_DIR assignments remain untrusted.
  return /^PROJECT_DIR="\$\{CLAUDE_PROJECT_DIR:-\$\(git rev-parse --show-toplevel 2>\s*\/dev\/null \|\| pwd\)\}"$/u.test(
    segment.trim(),
  );
}

function usesOverriddenProjectDirectoryVariable(segment: string): boolean {
  return /(?:^|\s)(?:env\s+)?(?:PROJECT_DIR|CLAUDE_PROJECT_DIR)=/u.test(segment);
}

function withoutDocumentedFailureNotice(segment: string): string {
  // The automatic invocation line appends this notice with `||` so a failed
  // helper becomes visible. The helper still runs first, so it is safe to
  // recognize; any other shell continuation remains an untrusted boundary.
  const separator = segment.lastIndexOf('||');
  if (separator === -1) return segment;

  const command = segment.slice(0, separator).trim();
  const fallbackWords = commandWords(segment.slice(separator + '||'.length));
  return fallbackWords.length === 2 &&
    fallbackWords[0] === 'echo' &&
    fallbackWords[1] === FAILURE_NOTICE
    ? command
    : segment;
}

/**
 * Parse the contiguous, execution-order `&&` prefix of trusted proof helpers.
 *
 * A leading `PROJECT_DIR=…` assignment is the documented skill prelude, not a
 * helper command. Once a real command appears, any non-helper stops the queue
 * so a short-circuited tail cannot borrow the current session's proof.
 */
export function parseRecordSkillInvocationCommands(
  command: string,
  projectDirectory: string,
  options: { claudeProjectDirectory?: string } = {},
): { skillName: string }[] {
  const commands: { skillName: string }[] = [];
  const segments = command.split(/\s+&&\s+/);
  let hasHelper = false;
  const trustedProjectDirectoryVariables = new Set<string>();

  if (
    options.claudeProjectDirectory !== undefined &&
    normalizeComparablePath(options.claudeProjectDirectory) ===
      normalizeComparablePath(projectDirectory)
  ) {
    trustedProjectDirectoryVariables.add('$CLAUDE_PROJECT_DIR');
  }

  for (const segment of segments) {
    const executableSegment = withoutDocumentedFailureNotice(segment);
    const words = commandWords(executableSegment);
    if (!hasHelper && words.length === 0) {
      if (hasDocumentedProjectDirectoryPrelude(segment)) {
        trustedProjectDirectoryVariables.add('$PROJECT_DIR');
        continue;
      }
      break;
    }

    // Do not treat a helper found after a newline, pipe, `||`, or `;` as an
    // executable `&&` continuation. splitShellSegments is the shared shell
    // tokenizer; a multi-segment result is therefore never a trusted queue item.
    if (splitShellSegments(executableSegment).length !== 1) break;
    if (usesOverriddenProjectDirectoryVariable(executableSegment)) break;

    const parsed = parseRecordSkillInvocationCommand(executableSegment);
    if (
      parsed === undefined ||
      !isTrustedInvocationPath({
        helperPath: words[1],
        projectArgument: words[2],
        projectDirectory,
        trustedProjectDirectoryVariables,
      })
    ) {
      break;
    }

    commands.push(parsed);
    hasHelper = true;
  }

  return commands;
}

/** True when any segment of `command` runs write-review-stamp.ts under bun. */
export function commandInvokesWriteReviewStamp(command: string): boolean {
  return splitShellSegments(command).some(segment => {
    const words = commandWords(segment);
    return isBunExecutable(words[0]) && isReviewStampHelperPath(words[1]);
  });
}

/**
 * Codex and Cursor slash-command fallback commands run as shell tool calls. The
 * runtime's pre-shell hook (Cursor `beforeShellExecution`, Codex `PreToolUse`)
 * sees the active session id immediately before that command runs, while the
 * command process itself does not receive the hook payload. This small,
 * short-lived, per-skill cache bridges that one-step gap. The two runtimes use
 * separate cache files so a Codex run can never satisfy a Cursor proof, or vice
 * versa.
 */
function rememberShellRunIdentity(input: RememberShellRunIdentityInput): boolean {
  const id = nonEmptyString(input.id);
  const skillNames = input.skillNames.filter(skillName => SKILL_NAME_PATTERN.test(skillName));
  if (id === undefined || skillNames.length === 0) return false;

  try {
    const cachePath = cachePathForProject(input.projectDirectory, input.cacheFile);
    mkdirSync(nodePath.dirname(cachePath), { recursive: true });
    writeFileSync(
      cachePath,
      JSON.stringify({
        entries: skillNames.map(skillName => ({
          id,
          skillName,
          recordedAt: (input.now ?? new Date()).toISOString(),
        })),
      }),
      'utf8',
    );
    return true;
  } catch {
    // This cache is a proof-path aid. It must not make the shell gate crash.
    return false;
  }
}

function readFreshShellRunIdentity(input: ReadFreshShellRunIdentityInput): string | undefined {
  const cachePath = cachePathForProject(input.projectDirectory, input.cacheFile);
  if (!existsSync(cachePath)) return undefined;

  try {
    const parsed = JSON.parse(readFileSync(cachePath, 'utf8')) as Partial<ShellRunIdentityCache> &
      Partial<ShellRunIdentityEntry>;
    // A previous packaged bridge can still write the single-entry shape while
    // the installed recorder has already upgraded. Reading that one entry is
    // safe and keeps a legitimate first proof from being discarded; all new
    // writers emit the ordered `entries` shape.
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries
      : parsed.id && parsed.skillName && parsed.recordedAt
        ? [parsed as ShellRunIdentityEntry]
        : [];
    const entry = entries[0];
    const id = nonEmptyString(entry?.id);
    if (id === undefined || entry?.skillName !== input.skillName) {
      rmSync(cachePath, { force: true });
      return undefined;
    }

    const recordedAtMs = Date.parse(entry.recordedAt ?? '');
    if (!Number.isFinite(recordedAtMs)) {
      rmSync(cachePath, { force: true });
      return undefined;
    }

    const nowMs = (input.now ?? new Date()).getTime();
    const maxAgeMs = input.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    if (nowMs - recordedAtMs > maxAgeMs) {
      rmSync(cachePath, { force: true });
      return undefined;
    }

    const rest = entries.slice(1);
    if (rest.length > 0) writeFileSync(cachePath, JSON.stringify({ entries: rest }), 'utf8');
    else rmSync(cachePath, { force: true });
    return id;
  } catch {
    rmSync(cachePath, { force: true });
    return undefined;
  }
}

export function rememberCursorRunIdentity(input: RememberCursorRunIdentityInput): boolean {
  return rememberShellRunIdentity({
    projectDirectory: input.projectDirectory,
    cacheFile: CURSOR_RUN_IDENTITY_CACHE,
    id: input.conversationId,
    skillNames: input.skillNames,
    now: input.now,
  });
}

export function readFreshCursorRunIdentity(input: ReadFreshRunIdentityInput): string | undefined {
  return readFreshShellRunIdentity({
    projectDirectory: input.projectDirectory,
    cacheFile: CURSOR_RUN_IDENTITY_CACHE,
    skillName: input.skillName,
    now: input.now,
    maxAgeMs: input.maxAgeMs,
  });
}

export function rememberCodexRunIdentity(input: RememberCodexRunIdentityInput): boolean {
  return rememberShellRunIdentity({
    projectDirectory: input.projectDirectory,
    cacheFile: CODEX_RUN_IDENTITY_CACHE,
    id: input.sessionId,
    skillNames: input.skillNames,
    now: input.now,
  });
}

export function readFreshCodexRunIdentity(input: ReadFreshRunIdentityInput): string | undefined {
  return readFreshShellRunIdentity({
    projectDirectory: input.projectDirectory,
    cacheFile: CODEX_RUN_IDENTITY_CACHE,
    skillName: input.skillName,
    now: input.now,
    maxAgeMs: input.maxAgeMs,
  });
}

interface RememberReviewStampIdentityInput {
  projectDirectory: string;
  id: string | undefined;
  now?: Date;
}

interface ReadFreshReviewStampIdentityInput {
  projectDirectory: string;
  now?: Date;
  maxAgeMs?: number;
}

export function rememberCursorReviewStampIdentity(
  input: RememberReviewStampIdentityInput,
): boolean {
  return rememberShellRunIdentity({
    projectDirectory: input.projectDirectory,
    cacheFile: CURSOR_REVIEW_STAMP_IDENTITY_CACHE,
    id: input.id,
    skillNames: [REVIEW_STAMP_CACHE_KEY],
    now: input.now,
  });
}

export function readFreshCursorReviewStampIdentity(
  input: ReadFreshReviewStampIdentityInput,
): string | undefined {
  return readFreshShellRunIdentity({
    projectDirectory: input.projectDirectory,
    cacheFile: CURSOR_REVIEW_STAMP_IDENTITY_CACHE,
    skillName: REVIEW_STAMP_CACHE_KEY,
    now: input.now,
    maxAgeMs: input.maxAgeMs,
  });
}

export function rememberCodexReviewStampIdentity(input: RememberReviewStampIdentityInput): boolean {
  return rememberShellRunIdentity({
    projectDirectory: input.projectDirectory,
    cacheFile: CODEX_REVIEW_STAMP_IDENTITY_CACHE,
    id: input.id,
    skillNames: [REVIEW_STAMP_CACHE_KEY],
    now: input.now,
  });
}

export function readFreshCodexReviewStampIdentity(
  input: ReadFreshReviewStampIdentityInput,
): string | undefined {
  return readFreshShellRunIdentity({
    projectDirectory: input.projectDirectory,
    cacheFile: CODEX_REVIEW_STAMP_IDENTITY_CACHE,
    skillName: REVIEW_STAMP_CACHE_KEY,
    now: input.now,
    maxAgeMs: input.maxAgeMs,
  });
}
