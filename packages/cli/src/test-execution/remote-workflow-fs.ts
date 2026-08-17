import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, linkSync, openSync, unlinkSync, writeSync } from 'node:fs';
import nodePath from 'node:path';

interface PublicationHooks {
  readonly beforeLink?: () => void;
}

export type ExclusivePublicationResult =
  | { readonly published: true; readonly privatePath: string }
  | { readonly published: false; readonly privatePath: string; readonly code: string };

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'UNKNOWN';
}

export function publishExclusiveFile(
  destination: string,
  content: string,
  hooks: PublicationHooks = {},
): ExclusivePublicationResult {
  const directory = nodePath.dirname(destination);
  const privatePath = nodePath.join(directory, `.safeword-${randomUUID()}`);
  const descriptor = openSync(privatePath, 'wx', 0o600);
  try {
    writeSync(descriptor, content);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }

  hooks.beforeLink?.();
  try {
    linkSync(privatePath, destination);
    return { published: true, privatePath };
  } catch (error) {
    return { published: false, privatePath, code: errorCode(error) };
  } finally {
    unlinkSync(privatePath);
  }
}
