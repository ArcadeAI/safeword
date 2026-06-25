import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { resolveNamespaceRoot } from './namespace-root.ts';

export const CURSOR_RUN_IDENTITY_CACHE = 'cursor-run-identity.json';

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

interface CursorRunIdentityCache {
  conversationId: string;
  recordedAt: string;
}

interface RememberCursorRunIdentityInput {
  projectDirectory: string;
  conversationId: string | undefined;
  now?: Date;
}

interface ReadFreshCursorRunIdentityInput {
  projectDirectory: string;
  now?: Date;
  maxAgeMs?: number;
}

function nonEmptyString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function cachePathForProject(projectDirectory: string): string {
  return nodePath.join(resolveNamespaceRoot(projectDirectory), CURSOR_RUN_IDENTITY_CACHE);
}

/**
 * Cursor slash-command fallback commands run as Shell tool calls. The
 * beforeShellExecution hook sees the active `conversation_id` immediately before
 * that command runs, while the command process itself does not receive the hook
 * payload. This small cache bridges that one-step gap.
 */
export function rememberCursorRunIdentity(input: RememberCursorRunIdentityInput): boolean {
  const conversationId = nonEmptyString(input.conversationId);
  if (conversationId === undefined) return false;

  try {
    const cachePath = cachePathForProject(input.projectDirectory);
    mkdirSync(nodePath.dirname(cachePath), { recursive: true });
    writeFileSync(
      cachePath,
      JSON.stringify({
        conversationId,
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

export function readFreshCursorRunIdentity(
  input: ReadFreshCursorRunIdentityInput,
): string | undefined {
  const cachePath = cachePathForProject(input.projectDirectory);
  if (!existsSync(cachePath)) return undefined;

  try {
    const parsed = JSON.parse(readFileSync(cachePath, 'utf8')) as Partial<CursorRunIdentityCache>;
    const conversationId = nonEmptyString(parsed.conversationId);
    if (conversationId === undefined) return undefined;

    const recordedAtMs = Date.parse(parsed.recordedAt ?? '');
    if (!Number.isFinite(recordedAtMs)) return undefined;

    const nowMs = (input.now ?? new Date()).getTime();
    const maxAgeMs = input.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    if (nowMs - recordedAtMs > maxAgeMs) return undefined;

    return conversationId;
  } catch {
    return undefined;
  }
}
