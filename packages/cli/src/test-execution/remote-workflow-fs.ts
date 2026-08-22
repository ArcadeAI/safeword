import { randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  type Stats,
  unlinkSync,
  writeSync,
} from 'node:fs';
import nodePath from 'node:path';

export interface RemoteWorkflowFs {
  readonly privatePath: (directory: string) => string;
  readonly lstat: (path: string) => Stats | undefined;
  readonly mkdir: (path: string) => void;
  readonly openRead: (path: string) => number;
  readonly openPrivate: (path: string) => number;
  readonly fstat: (descriptor: number) => Stats;
  readonly read: (descriptor: number) => string;
  readonly write: (descriptor: number, bytes: Uint8Array, offset: number) => number;
  readonly sync: (descriptor: number) => void;
  readonly close: (descriptor: number) => void;
  readonly link: (privatePath: string, destination: string) => void;
  readonly rename: (privatePath: string, destination: string) => void;
  readonly unlink: (path: string) => void;
}

export const nodeRemoteWorkflowFs: RemoteWorkflowFs = {
  privatePath: directory => nodePath.join(directory, `.safeword-${randomUUID()}`),
  lstat: path => lstatSync(path, { throwIfNoEntry: false }),
  mkdir: mkdirSync,
  openRead: path =>
    openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0)),
  openPrivate: path => openSync(path, 'wx', 0o644),
  fstat: fstatSync,
  read: descriptor => readFileSync(descriptor, 'utf8'),
  write: (descriptor, bytes, offset) => writeSync(descriptor, bytes, offset),
  sync: fsyncSync,
  close: closeSync,
  link: linkSync,
  rename: renameSync,
  unlink: unlinkSync,
};

export function filesystemErrorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'UNKNOWN';
}

export function isStablePathError(code: string): boolean {
  return ['EACCES', 'ELOOP', 'ENAMETOOLONG', 'ENOTDIR'].includes(code);
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
      readonly operation: 'create' | 'write' | 'sync' | 'close' | 'link';
      readonly code: string;
      readonly cleanupCode?: string;
    };

export type ReplacementPublicationResult =
  | { readonly replaced: true; readonly privatePath: string }
  | {
      readonly replaced: false;
      readonly privatePath: string;
      readonly operation: 'create' | 'write' | 'sync' | 'close' | 'check' | 'rename';
      readonly code: string;
      readonly cleanupCode?: string;
    };

type Preparation =
  | { readonly ready: true; readonly descriptor: number }
  | {
      readonly ready: false;
      readonly operation: 'create';
      readonly code: string;
    }
  | {
      readonly ready: false;
      readonly descriptor: number;
      readonly operation: 'write' | 'sync';
      readonly code: string;
    };

function preparePrivateFile(
  privatePath: string,
  content: string,
  filesystem: RemoteWorkflowFs,
): Preparation {
  let descriptor: number;
  try {
    descriptor = filesystem.openPrivate(privatePath);
  } catch (error) {
    return { ready: false, operation: 'create', code: filesystemErrorCode(error) };
  }

  const bytes = Buffer.from(content);
  let offset = 0;
  try {
    while (offset < bytes.length) {
      const written = filesystem.write(descriptor, bytes, offset);
      if (written === 0) {
        return { ready: false, descriptor, operation: 'write', code: 'ESHORTWRITE' };
      }
      offset += written;
    }
  } catch (error) {
    return {
      ready: false,
      descriptor,
      operation: 'write',
      code: filesystemErrorCode(error),
    };
  }

  try {
    filesystem.sync(descriptor);
    return { ready: true, descriptor };
  } catch (error) {
    return {
      ready: false,
      descriptor,
      operation: 'sync',
      code: filesystemErrorCode(error),
    };
  }
}

function cleanupPrivateFile(privatePath: string, filesystem: RemoteWorkflowFs): string | undefined {
  try {
    filesystem.unlink(privatePath);
    return undefined;
  } catch (error) {
    return filesystemErrorCode(error);
  }
}

type PrivateFileFailure = {
  readonly operation: 'create' | 'write' | 'sync' | 'close';
  readonly code: string;
};

type PublicationFailure =
  PrivateFileFailure | { readonly operation: 'link'; readonly code: string };

function closePrivateFile(
  descriptor: number,
  filesystem: RemoteWorkflowFs,
): PrivateFileFailure | undefined {
  try {
    filesystem.close(descriptor);
    return undefined;
  } catch (error) {
    return { operation: 'close', code: filesystemErrorCode(error) };
  }
}

function linkPrivateFile(
  privatePath: string,
  destination: string,
  filesystem: RemoteWorkflowFs,
): PublicationFailure | undefined {
  try {
    filesystem.link(privatePath, destination);
    return undefined;
  } catch (error) {
    return { operation: 'link', code: filesystemErrorCode(error) };
  }
}

export function publishExclusiveFile(
  destination: string,
  content: string,
  filesystem: RemoteWorkflowFs = nodeRemoteWorkflowFs,
): ExclusivePublicationResult {
  const privatePath = filesystem.privatePath(nodePath.dirname(destination));
  const preparation = preparePrivateFile(privatePath, content, filesystem);
  if (!('descriptor' in preparation)) {
    return {
      published: false,
      privatePath,
      operation: preparation.operation,
      code: preparation.code,
    };
  }
  const descriptor = preparation.descriptor;

  const preparationFailure: PrivateFileFailure | undefined = preparation.ready
    ? undefined
    : { operation: preparation.operation, code: preparation.code };
  const closeFailure = closePrivateFile(descriptor, filesystem);
  const failure =
    preparationFailure ?? closeFailure ?? linkPrivateFile(privatePath, destination, filesystem);

  const cleanupCode = cleanupPrivateFile(privatePath, filesystem);
  return failure === undefined
    ? { published: true, privatePath, ...(cleanupCode !== undefined && { cleanupCode }) }
    : {
        published: false,
        privatePath,
        ...failure,
        ...(cleanupCode !== undefined && { cleanupCode }),
      };
}

function replacePreparedFile(
  privatePath: string,
  destination: string,
  canReplace: () => boolean,
  filesystem: RemoteWorkflowFs,
): ReplacementPublicationResult {
  if (!canReplace()) {
    return { replaced: false, privatePath, operation: 'check', code: 'ECHANGED' };
  }
  try {
    filesystem.rename(privatePath, destination);
    return { replaced: true, privatePath };
  } catch (error) {
    return {
      replaced: false,
      privatePath,
      operation: 'rename',
      code: filesystemErrorCode(error),
    };
  }
}

export function publishReplacementFile(
  destination: string,
  content: string,
  canReplace: () => boolean,
  filesystem: RemoteWorkflowFs = nodeRemoteWorkflowFs,
): ReplacementPublicationResult {
  const privatePath = filesystem.privatePath(nodePath.dirname(destination));
  const preparation = preparePrivateFile(privatePath, content, filesystem);
  if (!('descriptor' in preparation)) {
    return {
      replaced: false,
      privatePath,
      operation: preparation.operation,
      code: preparation.code,
    };
  }
  const preparationFailure: PrivateFileFailure | undefined = preparation.ready
    ? undefined
    : { operation: preparation.operation, code: preparation.code };
  const closeFailure = closePrivateFile(preparation.descriptor, filesystem);
  let failure: ReplacementPublicationResult | undefined;
  const privateFileFailure = preparationFailure ?? closeFailure;
  if (privateFileFailure === undefined) {
    const replacement = replacePreparedFile(privatePath, destination, canReplace, filesystem);
    if (replacement.replaced) return replacement;
    failure = replacement;
  } else {
    failure = {
      replaced: false,
      privatePath,
      ...privateFileFailure,
    };
  }
  const cleanupCode = cleanupPrivateFile(privatePath, filesystem);
  return cleanupCode === undefined ? failure : { ...failure, cleanupCode };
}
