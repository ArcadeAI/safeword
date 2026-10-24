import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse, type ParseError } from 'jsonc-parser';

import { canonical } from './contract.js';

type Fields = Record<string, unknown>;

function fields(value: unknown): Fields {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Unsupported bun.lock structure; restore the frozen installation');
  return value as Fields;
}

function manifest(path: string): Fields {
  return fields(JSON.parse(readFileSync(path, 'utf8')));
}

const declarations = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

function readLock(root: string): Fields {
  const errors: ParseError[] = [];
  const bytes = readFileSync(nodePath.join(root, 'bun.lock'), 'utf8');
  const lock = fields(parse(bytes, errors, { allowTrailingComma: true }));
  if (errors.length > 0 || lock.lockfileVersion !== 1 || lock.configVersion !== 1)
    throw new Error('Unsupported bun.lock; restore the committed lock and frozen installation');
  return lock;
}

function checkManifest(actual: Fields, locked: Fields, path: string): void {
  const changedDeclarations = declarations.some(
    section => canonical(actual[section] ?? {}) !== canonical(locked[section] ?? {}),
  );
  const changedVersion = locked.version !== undefined && actual.version !== locked.version;
  if (changedDeclarations || changedVersion || actual.name !== locked.name)
    throw new Error(`Manifest ${path} disagrees with bun.lock; restore the frozen installation`);
}

function allowedPackages(root: string, manifests: string[], lock: Fields): Set<string> {
  const workspaces = fields(lock.workspaces);
  const allowed = new Set<string>();
  for (const path of manifests) {
    const actual = manifest(nodePath.join(root, path));
    const parent = nodePath.dirname(path);
    const workspace = parent === '.' ? '' : parent;
    checkManifest(actual, fields(workspaces[workspace]), path);
    if (workspace === '' && canonical(actual.overrides ?? {}) !== canonical(lock.overrides ?? {}))
      throw new Error(`Manifest ${path} disagrees with bun.lock; restore the frozen installation`);
    if (typeof actual.name === 'string' && typeof actual.version === 'string')
      allowed.add(`${actual.name}@${actual.version}`);
  }
  addLockedPackages(allowed, lock);
  return allowed;
}

function addLockedPackages(allowed: Set<string>, lock: Fields): void {
  const rows = Object.values(fields(lock.packages));
  for (const row of rows) {
    if (!Array.isArray(row) || typeof row[0] !== 'string')
      throw new Error('Unsupported bun.lock package row; restore the frozen installation');
    const identity: string = row[0];
    if (!identity.includes('@workspace:')) allowed.add(identity);
  }
}

function inspectPackage(directory: string, allowed: Set<string>): void {
  // Links are already checked by treeIdentity; physical Bun store bodies are inspected below.
  if (lstatSync(directory).isSymbolicLink()) return;
  const path = nodePath.join(directory, 'package.json');
  if (existsSync(path)) {
    const installed = manifest(path);
    const identity = `${String(installed.name)}@${String(installed.version)}`;
    if (!allowed.has(identity))
      throw new Error(
        `Installed dependency ${identity} is absent from bun.lock; restore the frozen installation`,
      );
  }
  const nested = nodePath.join(directory, 'node_modules');
  if (existsSync(nested)) inspectModules(nested, allowed);
}

function inspectStore(directory: string, allowed: Set<string>): void {
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const nested = nodePath.join(directory, entry.name, 'node_modules');
    if (entry.isDirectory() && existsSync(nested)) inspectModules(nested, allowed);
  }
}

function inspectModules(directory: string, allowed: Set<string>): void {
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = nodePath.join(directory, entry.name);
    if (entry.name === '.bun' && entry.isDirectory()) {
      inspectStore(path, allowed);
    } else if (entry.name.startsWith('@') && entry.isDirectory()) {
      for (const name of readdirSync(path)) inspectPackage(nodePath.join(path, name), allowed);
    } else if (!entry.name.startsWith('.')) {
      inspectPackage(path, allowed);
    }
  }
}

function installedResolution(root: string, workspace: string, name: string): Fields | undefined {
  let directory = nodePath.resolve(root, workspace);
  while (true) {
    const path = nodePath.join(directory, 'node_modules', name, 'package.json');
    if (existsSync(path)) return manifest(path);
    if (directory === root) return undefined;
    directory = nodePath.dirname(directory);
  }
}

function lockedResolution(lock: Fields, workspaceName: string, name: string): string {
  const packages = fields(lock.packages);
  const row = packages[`${workspaceName}/${name}`] ?? packages[name];
  if (!Array.isArray(row) || typeof row[0] !== 'string')
    throw new Error(`Unsupported bun.lock resolution for ${name}; restore the frozen installation`);
  const identity: string = row[0];
  const separator = '@workspace:';
  if (!identity.includes(separator)) return identity;
  const workspace = fields(fields(lock.workspaces)[identity.split(separator)[1] ?? '']);
  return `${String(workspace.name)}@${String(workspace.version)}`;
}

function requireWorkspaceResolution(root: string, path: string, lock: Fields): void {
  const actual = manifest(nodePath.join(root, path));
  const dependencies = {
    ...fields(actual.dependencies ?? {}),
    ...fields(actual.devDependencies ?? {}),
  };
  for (const name of Object.keys(dependencies)) {
    const installed = installedResolution(root, nodePath.dirname(path), name);
    const identity =
      installed === undefined
        ? 'missing'
        : `${String(installed.name)}@${String(installed.version)}`;
    const expected = lockedResolution(lock, String(actual.name), name);
    if (identity !== expected)
      throw new Error(
        `Installed dependency ${name} resolves to ${identity}, expected ${expected}; restore the frozen installation`,
      );
  }
}

/** Check prerequisites without installing, fetching, or rewriting the candidate. */
export function requireLockedDependencies(
  root: string,
  manifests: string[],
  roots: string[],
): void {
  const lock = readLock(root);
  const allowed = allowedPackages(root, manifests, lock);
  for (const relative of roots) inspectModules(nodePath.join(root, relative), allowed);
  for (const path of manifests) requireWorkspaceResolution(root, path, lock);
}
