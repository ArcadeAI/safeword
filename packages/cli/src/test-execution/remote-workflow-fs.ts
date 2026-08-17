import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, linkSync, openSync, unlinkSync, writeSync } from 'node:fs';
import nodePath from 'node:path';

export interface PublicationHooks {
  readonly beforeLink?: () => void;
  readonly cleanup?: (privatePath: string) => void;
}

export type ExclusivePublicationResult =
  | {
      readonly published: true;
      readonly privatePath: string;
      readonly cleanupCode?: string;
    }
  | {
      readonly published: false;
      readonly privatePath: string;
      readonly operation: 'create' | 'write' | 'sync' | 'link';
      readonly code: string;
      readonly cleanupCode?: string;
    };

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'UNKNOWN';
}

function writeAll(descriptor: number, content: string): string | undefined {
  const bytes = Buffer.from(content);
  let offset = 0;
  try {
    while (offset < bytes.length) {
      const written = writeSync(descriptor, bytes, offset);
      if (written === 0) return 'EIO';
      offset += written;
    }
    return undefined;
  } catch (error) {
    return errorCode(error);
  }
}

type Preparation = {
  readonly descriptor?: number;
  readonly operation?: 'create' | 'write' | 'sync';
  readonly code?: string;
};

function preparePrivateFile(privatePath: string, content: string): Preparation {
  let descriptor: number;
  try {
    descriptor = openSync(privatePath, 'wx', 0o600);
  } catch (error) {
    return { operation: 'create', code: errorCode(error) };
  }
  const writeCode = writeAll(descriptor, content);
  if (writeCode !== undefined) return { descriptor, operation: 'write', code: writeCode };
  try {
    fsyncSync(descriptor);
    return { descriptor };
  } catch (error) {
    return { descriptor, operation: 'sync', code: errorCode(error) };
  }
}

function cleanupPrivateFile(
  privatePath: string,
  cleanup: (path: string) => void = unlinkSync,
): string | undefined {
  try {
    cleanup(privatePath);
    return undefined;
  } catch (error) {
    return errorCode(error);
  }
}

type PublicationFailure = {
  readonly operation: 'create' | 'write' | 'sync' | 'link';
  readonly code: string;
};

function linkPrivateFile(privatePath: string, destination: string): PublicationFailure | undefined {
  try {
    linkSync(privatePath, destination);
    return undefined;
  } catch (error) {
    return { operation: 'link', code: errorCode(error) };
  }
}

function finishPublication(
  privatePath: string,
  failure: PublicationFailure | undefined,
  cleanup?: PublicationHooks['cleanup'],
): ExclusivePublicationResult {
  const cleanupCode = cleanupPrivateFile(privatePath, cleanup);
  return failure === undefined
    ? { published: true, privatePath, ...(cleanupCode !== undefined && { cleanupCode }) }
    : {
        published: false,
        privatePath,
        ...failure,
        ...(cleanupCode !== undefined && { cleanupCode }),
      };
}

export function publishExclusiveFile(
  destination: string,
  content: string,
  hooks: PublicationHooks = {},
): ExclusivePublicationResult {
  const directory = nodePath.dirname(destination);
  const privatePath = nodePath.join(directory, `.safeword-${randomUUID()}`);
  const preparation = preparePrivateFile(privatePath, content);
  if (preparation.descriptor === undefined) {
    return {
      published: false,
      privatePath,
      operation: preparation.operation ?? 'create',
      code: preparation.code ?? 'UNKNOWN',
    };
  }
  closeSync(preparation.descriptor);

  let failure: PublicationFailure | undefined =
    preparation.operation === undefined || preparation.code === undefined
      ? undefined
      : { operation: preparation.operation, code: preparation.code };

  if (failure === undefined) {
    hooks.beforeLink?.();
    failure = linkPrivateFile(privatePath, destination);
  }
  return finishPublication(privatePath, failure, hooks.cleanup);
}
