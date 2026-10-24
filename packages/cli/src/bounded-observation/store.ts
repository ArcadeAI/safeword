import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { writeDurableFileExclusive } from '../codex-plugin/durable-write.js';
import { canonical, deliveryTicket, digest, profileSha256, purpose } from './contract.js';
import type { ToolDetails } from './tools.js';

export interface AttemptStart {
  schema_version: 1;
  purpose: typeof purpose;
  authority: 'execution-only';
  ticket: typeof deliveryTicket;
  root: string;
  attempt_id: string;
  candidate_commit: string;
  profile_sha256: string;
  runtime_sha256: string;
  inputs: Record<string, string>;
  command: { public_argv: string[]; runner_argv: string[] };
  clone: string;
  started_at: string;
}

export interface AttemptTerminal extends AttemptStart {
  tools: Record<string, ToolDetails>;
  execution_environment: NodeJS.ProcessEnv;
  status: 'observed' | 'refused' | 'interrupted';
  finished_at: string;
  problem?: string;
  report_path: string;
  report_sha256: string;
  artifacts: Record<string, string>;
  case_results: {
    case_id: string;
    assertions: { file: string; full_name: string; status: string }[];
  }[];
}

export interface AttemptStore {
  base: string;
  namespace: string;
  key: Buffer;
}

function privateDirectory(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { mode: 0o700 });
  requirePrivateDirectory(path);
}

function requirePrivateDirectory(path: string): void {
  const info = lstatSync(path);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) {
    throw new Error(`Unsafe observer state directory ${path}; restore a private directory`);
  }
}

function safeBytes(path: string): Buffer {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(descriptor);
    if (!info.isFile() || (info.mode & 0o077) !== 0)
      throw new Error(`Unsafe evidence file ${path}`);
    return readFileSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

export function openStore(root: string, create: boolean): AttemptStore {
  const state = nodePath.resolve(
    process.env.XDG_STATE_HOME ?? nodePath.join(homedir(), '.local/state'),
  );
  if (state === root || state.startsWith(`${root}${nodePath.sep}`)) {
    throw new Error('Observer state must be outside the source checkout');
  }
  if (create) mkdirSync(state, { recursive: true, mode: 0o700 });
  const parent = realpathSync(state);
  if (parent === root || parent.startsWith(`${root}${nodePath.sep}`)) {
    throw new Error('Resolved observer state must be outside the source checkout');
  }
  const safeword = nodePath.join(parent, 'safeword');
  const base = nodePath.join(safeword, 'bounded-observation');
  const namespace = nodePath.join(base, digest(root));
  for (const path of [safeword, base, namespace]) {
    if (create) privateDirectory(path);
    else requirePrivateDirectory(path);
  }
  return { base, namespace, key: privateKey(base, create) };
}

function privateKey(base: string, create: boolean): Buffer {
  const keyPath = nodePath.join(base, 'observer.key');
  if (create && !existsSync(keyPath)) {
    try {
      writeDurableFileExclusive(keyPath, randomBytes(32), { mode: 0o600 });
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    }
  }
  const key = safeBytes(keyPath);
  if (key.length !== 32)
    throw new Error(
      'Observer key is corrupt; preserve evidence and restore the private key or run anew',
    );
  return key;
}

export function attemptPath(store: AttemptStore, id: string): string {
  if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u.test(id)) {
    throw new Error('Unsafe attempt identity; use the retained UUID');
  }
  const path = nodePath.join(store.namespace, id);
  if (existsSync(path)) {
    const info = lstatSync(path);
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) {
      throw new Error('Unsafe attempt directory; preserve evidence and observe again');
    }
  }
  return path;
}

export function reserveAttempt(store: AttemptStore): { id: string; directory: string } {
  const id = randomUUID();
  const directory = attemptPath(store, id);
  mkdirSync(directory, { mode: 0o700 });
  return { id, directory };
}

export function publishRecord(
  store: AttemptStore,
  directory: string,
  name: 'start' | 'terminal',
  value: AttemptStart | AttemptTerminal,
): void {
  const payload = canonical(value);
  const tag = createHmac('sha256', store.key).update(`${purpose}\0${payload}`).digest('hex');
  writeDurableFileExclusive(
    nodePath.join(directory, `${name}.json`),
    canonical({ payload: value, tag }),
    { mode: 0o600 },
  );
}

export function readRecord(
  store: AttemptStore,
  directory: string,
  name: 'start' | 'terminal',
  root: string,
  id: string,
): AttemptStart | AttemptTerminal {
  const record = JSON.parse(
    safeBytes(nodePath.join(directory, `${name}.json`)).toString('utf8'),
  ) as { payload: AttemptStart; tag: string };
  if (typeof record.tag !== 'string' || !/^[\da-f]{64}$/u.test(record.tag))
    throw new Error('Invalid observer authentication tag');
  const expected = createHmac('sha256', store.key)
    .update(`${purpose}\0${canonical(record.payload)}`)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(record.tag, 'hex')))
    throw new Error('Observer evidence authentication failed; preserve it and observe again');
  const value = record.payload;
  const identity = {
    schema_version: 1,
    purpose,
    ticket: deliveryTicket,
    root,
    attempt_id: id,
    profile_sha256: profileSha256,
    authority: 'execution-only',
  };
  for (const [key, expectedValue] of Object.entries(identity)) {
    if (value[key as keyof AttemptStart] !== expectedValue) {
      throw new Error(
        `Foreign or incompatible observer evidence (${key}); preserve it and run a new observation`,
      );
    }
  }
  return value;
}

export function artifactDigests(directory: string): Record<string, string> {
  return Object.fromEntries(
    ['stdout.log', 'stderr.log', 'diagnostic.log', 'report.json']
      .filter(name => existsSync(nodePath.join(directory, name)))
      .map(name => [name, digest(safeBytes(nodePath.join(directory, name)))]),
  );
}
