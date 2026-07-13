import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

interface ShellRunIdentityCache {
  id: string;
  skillName: string;
  recordedAt: string;
}

interface RememberShellRunIdentityInput {
  projectDirectory: string;
  cacheFile: string;
  id: string | undefined;
  skillName: string | undefined;
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
  skillName: string | undefined;
  now?: Date;
}

interface RememberCodexRunIdentityInput {
  projectDirectory: string;
  sessionId: string | undefined;
  skillName: string | undefined;
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
  return token.replaceAll('\\', '/').endsWith('/.safeword/hooks/record-skill-invocation.ts');
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
  const skillName = nonEmptyString(input.skillName);
  if (id === undefined || skillName === undefined) return false;

  try {
    const cachePath = cachePathForProject(input.projectDirectory, input.cacheFile);
    mkdirSync(nodePath.dirname(cachePath), { recursive: true });
    writeFileSync(
      cachePath,
      JSON.stringify({
        id,
        skillName,
        recordedAt: (input.now ?? new Date()).toISOString(),
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
    const parsed = JSON.parse(readFileSync(cachePath, 'utf8')) as Partial<ShellRunIdentityCache>;
    const id = nonEmptyString(parsed.id);
    if (id === undefined) return undefined;
    if (parsed.skillName !== input.skillName) return undefined;

    const recordedAtMs = Date.parse(parsed.recordedAt ?? '');
    if (!Number.isFinite(recordedAtMs)) return undefined;

    const nowMs = (input.now ?? new Date()).getTime();
    const maxAgeMs = input.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    if (nowMs - recordedAtMs > maxAgeMs) return undefined;

    return id;
  } catch {
    return undefined;
  } finally {
    rmSync(cachePath, { force: true });
  }
}

export function rememberCursorRunIdentity(input: RememberCursorRunIdentityInput): boolean {
  return rememberShellRunIdentity({
    projectDirectory: input.projectDirectory,
    cacheFile: CURSOR_RUN_IDENTITY_CACHE,
    id: input.conversationId,
    skillName: input.skillName,
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
    skillName: input.skillName,
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
    skillName: REVIEW_STAMP_CACHE_KEY,
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
    skillName: REVIEW_STAMP_CACHE_KEY,
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
