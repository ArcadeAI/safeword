import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { resolveNamespaceRoot } from './namespace-root.ts';

const CURSOR_RUN_IDENTITY_CACHE = 'cursor-run-identity.json';
const CODEX_RUN_IDENTITY_CACHE = 'codex-run-identity.json';

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

const SHELL_OPERATORS = new Set([';', '&&', '||', '|']);
const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function nonEmptyString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function cachePathForProject(projectDirectory: string, cacheFile: string): string {
  return nodePath.join(resolveNamespaceRoot(projectDirectory), cacheFile);
}

function isEnvironmentAssignment(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function isBunExecutable(token: string | undefined): boolean {
  if (token === undefined) return false;
  return nodePath.basename(token) === 'bun';
}

function isInvocationHelperPath(token: string | undefined): boolean {
  if (token === undefined) return false;
  return token.replaceAll('\\', '/').endsWith('/.safeword/hooks/record-skill-invocation.ts');
}

function tokenizeShellCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let escaped = false;

  function flush(): void {
    if (current.length > 0) {
      tokens.push(current);
      current = '';
    }
  }

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (char === undefined) continue;

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      flush();
      continue;
    }

    if (char === '&' && command[index + 1] === '&') {
      flush();
      tokens.push('&&');
      index += 1;
      continue;
    }

    if (char === '|' && command[index + 1] === '|') {
      flush();
      tokens.push('||');
      index += 1;
      continue;
    }

    if (char === ';' || char === '|') {
      flush();
      tokens.push(char);
      continue;
    }

    current += char;
  }

  flush();
  return tokens;
}

export function parseRecordSkillInvocationCommand(
  command: string,
): { skillName: string } | undefined {
  const tokens = tokenizeShellCommand(command);
  let segmentStart = 0;

  for (let index = 0; index <= tokens.length; index += 1) {
    if (index !== tokens.length && !SHELL_OPERATORS.has(tokens[index] ?? '')) {
      continue;
    }

    const segment = tokens.slice(segmentStart, index);
    segmentStart = index + 1;

    let executableIndex = 0;
    while (isEnvironmentAssignment(segment[executableIndex] ?? '')) {
      executableIndex += 1;
    }

    if (!isBunExecutable(segment[executableIndex])) continue;
    if (!isInvocationHelperPath(segment[executableIndex + 1])) continue;

    const skillName = nonEmptyString(segment[executableIndex + 3]);
    if (skillName !== undefined && SKILL_NAME_PATTERN.test(skillName)) {
      return { skillName };
    }
  }

  return undefined;
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
