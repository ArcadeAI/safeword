import { readFileSync } from 'node:fs';

export const RUST_SPLITS = ['train', 'validation', 'heldout'] as const;
export type RustSplit = (typeof RUST_SPLITS)[number];

export const ORACLE_KINDS = [
  'cargo-test',
  'cargo-check',
  'cargo-clippy',
  'benchmark',
  'deterministic-script',
] as const;
export type OracleKind = (typeof ORACLE_KINDS)[number];

export interface RustRepositoryRef {
  id: string;
  url: string;
  ref: string;
}

export interface RustSandboxMount {
  purpose: 'repo' | 'scratch' | 'cache';
  target: string;
  mode: 'ro' | 'rw';
}

export interface RustSandboxPolicy {
  runner: { kind: 'docker'; image: string };
  timeoutSeconds: number;
  resources: {
    cpus: number;
    memoryMb: number;
  };
  network: 'none' | 'prefetch-only';
  mounts: RustSandboxMount[];
  allowDockerSocket: false;
  privileged: false;
  userIsolation: 'rootless' | 'userns-remap' | 'non-root';
}

export interface RustExecutableOracle {
  kind: OracleKind;
  command: string;
}

export interface RustTask {
  id: string;
  repository: RustRepositoryRef;
  split: RustSplit;
  prompt: string;
  sandbox: RustSandboxPolicy;
  commands: string[];
  oracle: RustExecutableOracle;
}

export interface RustTaskManifest {
  tasks: RustTask[];
}

export type RepositoriesBySplit = Record<RustSplit, string[]>;

export function loadRustTaskManifest(path: string): RustTask[] {
  return validateRustTaskManifest(JSON.parse(readFileSync(path, 'utf8')) as unknown);
}

export function selectRustTasks(tasks: RustTask[], taskIds: string[]): RustTask[] {
  if (taskIds.length === 0) return tasks;

  const selected: RustTask[] = [];
  for (const taskId of taskIds) {
    const task = tasks.find(candidate => candidate.id === taskId);
    if (!task) {
      throw new Error(`task not found: ${taskId}`);
    }
    selected.push(task);
  }

  return selected;
}

export function validateRustTaskManifest(manifest: unknown): RustTask[] {
  const errors: string[] = [];
  if (!isRecord(manifest)) {
    throw new Error('Rust task manifest must be an object');
  }

  const rawTasks = manifest.tasks;
  if (!Array.isArray(rawTasks)) {
    throw new Error('tasks must be an array');
  }

  const tasks = rawTasks.map((raw, index) => validateTask(raw, index, errors));
  validateWholeRepositorySplits(tasks, errors);

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  return tasks;
}

export function repositoriesBySplit(tasks: RustTask[]): RepositoriesBySplit {
  const bySplit: Record<RustSplit, Set<string>> = {
    train: new Set(),
    validation: new Set(),
    heldout: new Set(),
  };

  for (const task of tasks) {
    bySplit[task.split].add(task.repository.id);
  }

  return {
    train: [...bySplit.train],
    validation: [...bySplit.validation],
    heldout: [...bySplit.heldout],
  };
}

function validateTask(raw: unknown, index: number, errors: string[]): RustTask {
  const path = `tasks[${index}]`;
  const task = isRecord(raw) ? raw : {};

  requireNonEmptyString(task.id, `${path}.id`, errors);
  validateRepository(task.repository, `${path}.repository`, errors);
  validateSplit(task.split, `${path}.split`, errors);
  requireNonEmptyString(task.prompt, `${path}.prompt`, errors);
  validateSandbox(task.sandbox, `${path}.sandbox`, errors);
  validateCommands(task.commands, `${path}.commands`, errors);
  validateOracle(task.oracle, `${path}.oracle`, errors);

  return task as unknown as RustTask;
}

function validateRepository(raw: unknown, path: string, errors: string[]): void {
  const repository = isRecord(raw) ? raw : {};
  requireNonEmptyString(repository.id, `${path}.id`, errors);
  requireNonEmptyString(repository.url, `${path}.url`, errors);
  requirePinnedGitRef(repository.ref, `${path}.ref`, errors);
}

function validateSplit(raw: unknown, path: string, errors: string[]): void {
  if (typeof raw !== 'string' || !RUST_SPLITS.includes(raw as RustSplit)) {
    errors.push(`${path} must be one of: ${RUST_SPLITS.join(', ')}`);
  }
}

function validateSandbox(raw: unknown, path: string, errors: string[]): void {
  const sandbox = isRecord(raw) ? raw : {};
  validateRunner(sandbox.runner, `${path}.runner`, errors);
  requirePositiveNumber(sandbox.timeoutSeconds, `${path}.timeoutSeconds`, errors);
  validateResources(sandbox.resources, `${path}.resources`, errors);
  validateNetwork(sandbox.network, `${path}.network`, errors);
  validateMounts(sandbox.mounts, `${path}.mounts`, errors);

  if (sandbox.allowDockerSocket !== false) {
    errors.push(`${path}.allowDockerSocket must be false`);
  }
  if (sandbox.privileged !== false) {
    errors.push(`${path}.privileged must be false`);
  }
  if (
    typeof sandbox.userIsolation !== 'string' ||
    !['rootless', 'userns-remap', 'non-root'].includes(sandbox.userIsolation)
  ) {
    errors.push(`${path}.userIsolation must be rootless, userns-remap, or non-root`);
  }
}

function validateRunner(raw: unknown, path: string, errors: string[]): void {
  const runner = isRecord(raw) ? raw : {};
  if (runner.kind !== 'docker') {
    errors.push(`${path}.kind must be docker`);
    return;
  }

  if (typeof runner.image !== 'string' || !isTaggedDigestReference(runner.image)) {
    errors.push(`${path}.image must include a tag and sha256 digest`);
  }
}

function isTaggedDigestReference(image: string): boolean {
  const digestMatch = image.match(/^(.+)@sha256:[a-f0-9]{64}$/i);
  if (!digestMatch) return false;

  const nameWithTag = digestMatch[1];
  const lastSlash = nameWithTag.lastIndexOf('/');
  const lastColon = nameWithTag.lastIndexOf(':');
  return lastColon > lastSlash && lastColon < nameWithTag.length - 1;
}

function validateResources(raw: unknown, path: string, errors: string[]): void {
  const resources = isRecord(raw) ? raw : {};
  requirePositiveNumber(resources.cpus, `${path}.cpus`, errors);
  requirePositiveNumber(resources.memoryMb, `${path}.memoryMb`, errors);
}

function validateNetwork(raw: unknown, path: string, errors: string[]): void {
  if (raw !== 'none' && raw !== 'prefetch-only') {
    errors.push(`${path} must be none or prefetch-only`);
  }
}

function validateMounts(raw: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push(`${path} must include repo and scratch mounts`);
    return;
  }

  let hasReadOnlyRepo = false;
  let hasWritableScratch = false;
  raw.forEach((mount, index) => {
    const mountPath = `${path}[${index}]`;
    const candidate = isRecord(mount) ? mount : {};
    if (!['repo', 'scratch', 'cache'].includes(String(candidate.purpose))) {
      errors.push(`${mountPath}.purpose must be repo, scratch, or cache`);
    }
    requireNonEmptyString(candidate.target, `${mountPath}.target`, errors);
    if (candidate.mode !== 'ro' && candidate.mode !== 'rw') {
      errors.push(`${mountPath}.mode must be ro or rw`);
    }
    if (candidate.purpose !== 'scratch' && candidate.mode === 'rw') {
      errors.push(`${mountPath}.mode must be ro unless purpose is scratch`);
    }
    if (candidate.purpose === 'repo') {
      if (candidate.mode === 'ro') hasReadOnlyRepo = true;
      else errors.push(`${mountPath}.mode must be ro for repo mounts`);
    }
    if (candidate.purpose === 'scratch' && candidate.mode === 'rw') {
      hasWritableScratch = true;
    }
  });

  if (!hasReadOnlyRepo) {
    errors.push(`${path} must include a read-only repo mount`);
  }
  if (!hasWritableScratch) {
    errors.push(`${path} must include a writable scratch mount`);
  }
}

function validateCommands(raw: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push(`${path} must include at least one allowed command`);
    return;
  }

  raw.forEach((command, index) => {
    requireNonEmptyString(command, `${path}[${index}]`, errors);
  });
}

function validateOracle(raw: unknown, path: string, errors: string[]): void {
  const oracle = isRecord(raw) ? raw : {};
  if (typeof oracle.kind !== 'string' || !ORACLE_KINDS.includes(oracle.kind as OracleKind)) {
    errors.push(`${path}.kind must be one of: ${ORACLE_KINDS.join(', ')}`);
  }
  requireNonEmptyString(oracle.command, `${path}.command`, errors);
}

function validateWholeRepositorySplits(tasks: RustTask[], errors: string[]): void {
  const splitsByRepository = new Map<string, Set<RustSplit>>();
  for (const task of tasks) {
    if (!task.repository?.id || !task.split) continue;
    const splits = splitsByRepository.get(task.repository.id) ?? new Set<RustSplit>();
    splits.add(task.split);
    splitsByRepository.set(task.repository.id, splits);
  }

  for (const [repository, splits] of splitsByRepository) {
    if (splits.size > 1) {
      errors.push(
        `repository "${repository}" appears in multiple splits: ${[...splits].join(', ')}`,
      );
    }
  }
}

function requireNonEmptyString(raw: unknown, path: string, errors: string[]): void {
  if (typeof raw !== 'string' || raw.trim() === '') {
    errors.push(`${path} is required`);
  }
}

function requirePinnedGitRef(raw: unknown, path: string, errors: string[]): void {
  if (typeof raw !== 'string' || !/^[a-f0-9]{40}$/i.test(raw)) {
    errors.push(`${path} must be a 40-character commit SHA`);
  }
}

function requirePositiveNumber(raw: unknown, path: string, errors: string[]): void {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    errors.push(`${path} must be a positive number`);
  }
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}
