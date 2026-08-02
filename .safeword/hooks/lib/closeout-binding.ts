import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { hasSafewordProjectMarker, resolveNamespaceRoot } from './namespace-root.js';
import { commandWords, splitShellSegments } from './shell-segments.js';

const CLOSEOUT_BINDING_CACHE = 'closeout-session-binding.json';
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

export interface CloseoutBinding {
  runtime: 'claude' | 'codex' | 'cursor';
  id: string;
  transcriptPath?: string;
}

interface CloseoutBindingCache extends CloseoutBinding {
  recordedAt: string;
}

interface RememberCloseoutBindingInput {
  projectDirectory: string;
  runtime: CloseoutBinding['runtime'];
  id: string | undefined;
  transcriptPath?: string;
  now?: Date;
}

interface ReadFreshCloseoutBindingInput {
  projectDirectory: string;
  now?: Date;
  maxAgeMs?: number;
}

function nonEmptyString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isCloseoutCleanupPath(token: string | undefined): boolean {
  if (token === undefined) return false;
  const normalized = token.replaceAll('\\', '/');
  return (
    normalized === '.safeword/scripts/closeout-cleanup.ts' ||
    normalized.endsWith('/.safeword/scripts/closeout-cleanup.ts')
  );
}

/** True only when an executable shell segment runs the installed closeout guard. */
export function commandInvokesCloseoutCleanup(command: string): boolean {
  return splitShellSegments(command).some(segment => {
    const words = commandWords(segment);
    return nodePath.basename(words[0] ?? '') === 'bun' && isCloseoutCleanupPath(words[1]);
  });
}

export function rememberCloseoutBinding(input: RememberCloseoutBindingInput): boolean {
  const id = nonEmptyString(input.id);
  if (id === undefined || !hasSafewordProjectMarker(input.projectDirectory)) return false;
  const transcriptPath = nonEmptyString(input.transcriptPath);
  try {
    const cachePath = nodePath.join(
      resolveNamespaceRoot(input.projectDirectory),
      CLOSEOUT_BINDING_CACHE,
    );
    mkdirSync(nodePath.dirname(cachePath), { recursive: true });
    writeFileSync(
      cachePath,
      JSON.stringify({
        runtime: input.runtime,
        id,
        ...(transcriptPath === undefined ? {} : { transcriptPath }),
        recordedAt: (input.now ?? new Date()).toISOString(),
      } satisfies CloseoutBindingCache),
      'utf8',
    );
    return true;
  } catch {
    return false;
  }
}

export function readFreshCloseoutBinding(
  input: ReadFreshCloseoutBindingInput,
): CloseoutBinding | undefined {
  const cachePath = nodePath.join(
    resolveNamespaceRoot(input.projectDirectory),
    CLOSEOUT_BINDING_CACHE,
  );
  if (!existsSync(cachePath)) return undefined;
  const claimPath = `${cachePath}.claim-${randomUUID()}`;
  try {
    // rename(2) is atomic within this directory: concurrent closeout commands
    // cannot both consume the same short-lived host-session proof.
    renameSync(cachePath, claimPath);
    const parsed = JSON.parse(readFileSync(claimPath, 'utf8')) as Partial<CloseoutBindingCache>;
    const id = nonEmptyString(parsed.id);
    if (id === undefined || !['claude', 'codex', 'cursor'].includes(parsed.runtime ?? '')) {
      return undefined;
    }
    const recordedAt = Date.parse(parsed.recordedAt ?? '');
    if (!Number.isFinite(recordedAt)) return undefined;
    if ((input.now ?? new Date()).getTime() - recordedAt > (input.maxAgeMs ?? DEFAULT_MAX_AGE_MS)) {
      return undefined;
    }
    const transcriptPath = nonEmptyString(parsed.transcriptPath);
    return {
      runtime: parsed.runtime as CloseoutBinding['runtime'],
      id,
      ...(transcriptPath === undefined ? {} : { transcriptPath }),
    };
  } catch {
    return undefined;
  } finally {
    rmSync(claimPath, { force: true });
  }
}
