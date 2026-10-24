import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
} from 'node:fs';
import nodePath from 'node:path';

import { parseTicketMetadata } from '../utils/ticket-metadata.js';
import { canonical, digest } from './contract.js';

const auditSummary =
  '.project/tickets/PPHQN5-observe-bounded-delivery-proof/evidence/observer-audit-summary.md';
const auditTickets = new Set([
  '.project/tickets/T3E4NS-keep-bounded-planning-reviews-trustworthy/ticket.md',
  '.project/tickets/PPHQN5-observe-bounded-delivery-proof/ticket.md',
]);
const auditFields = new Set(['phase', 'status', 'created', 'last_modified']);

export function git(root: string, argv: string[]): string {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...argv], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_NO_REPLACE_OBJECTS: '1',
    },
  });
}

export function canonicalRoot(cwd: string): string {
  return realpathSync(git(cwd, ['rev-parse', '--show-toplevel']).trim());
}

export function projectedFile(path: string, bytes: Buffer): string {
  if (!auditTickets.has(path)) return digest(bytes);
  const { metadata, body } = parseTicketMetadata(bytes.toString('utf8'));
  const bound = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !auditFields.has(key)),
  );
  const lines = body.replaceAll('\r\n', '\n').split('\n');
  const retained: string[] = [];
  let inLog = false;
  for (const line of lines) {
    if (line.trim() === '## Work Log') {
      inLog = true;
      continue;
    }
    if (inLog && line.startsWith('## ')) inLog = false;
    if (!inLog) retained.push(line);
  }
  return digest(canonical({ metadata: bound, body: retained.join('\n').trim() }));
}

export function sourceIdentity(root: string): Record<string, string> {
  const paths = git(root, ['ls-files', '-z']).split('\0').filter(Boolean);
  const inputs: Record<string, string> = {};
  for (const path of paths) {
    if (path === auditSummary) continue;
    const absolute = nodePath.join(root, path);
    const info = lstatSync(absolute);
    if (!info.isFile())
      throw new Error(`Unsupported tracked input ${path}; use regular committed files`);
    inputs[`file:${path}`] = projectedFile(path, readFileSync(absolute));
    inputs[`mode:${path}`] = digest(String((info.mode & 0o100) !== 0));
  }
  inputs['source:tracked'] = digest(canonical(inputs));
  return inputs;
}

export function requireCleanInputs(root: string): void {
  const tracked = git(root, ['diff', 'HEAD', '--name-only', '-z']).split('\0').filter(Boolean);
  for (const path of tracked) {
    if (path === auditSummary) continue;
    const current = nodePath.join(root, path);
    if (!auditTickets.has(path) || !existsSync(current)) {
      throw new Error(`Uncommitted input ${path}; commit or clean the candidate and rerun`);
    }
    const committed = Buffer.from(git(root, ['show', `HEAD:${path}`]));
    if (projectedFile(path, readFileSync(current)) !== projectedFile(path, committed)) {
      throw new Error(
        `Uncommitted semantic input ${path}; commit or clean the candidate and rerun`,
      );
    }
  }
  const unexpected = git(root, ['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(path => path !== '' && path !== auditSummary);
  if (unexpected.length > 0)
    throw new Error(`Uncommitted input ${unexpected[0]}; commit or clean the candidate and rerun`);
  if (git(root, ['rev-parse', '--is-shallow-repository']).trim() !== 'false') {
    throw new Error('Shallow Git input is unsupported; use a complete local checkout');
  }
  requireIndependentGitObjects(root);
}

function requireIndependentGitObjects(root: string): void {
  const gitDirectory = git(root, [
    'rev-parse',
    '--path-format=absolute',
    '--git-common-dir',
  ]).trim();
  if (
    existsSync(nodePath.join(gitDirectory, 'objects/info/alternates')) ||
    existsSync(nodePath.join(gitDirectory, 'info/grafts')) ||
    git(root, ['replace', '-l']).trim() !== ''
  ) {
    throw new Error(
      'External or replaced Git objects are unsupported; use an independent local checkout',
    );
  }
}

/** Hash bytes, link destinations and executable bits, normalized to the repository root. */
export function treeIdentity(root: string, relative: string): string {
  const base = realpathSync(root);
  const entries: [string, string][] = [];
  function visit(path: string): void {
    const absolute = nodePath.join(base, path);
    const info = lstatSync(absolute);
    if (info.isSymbolicLink()) {
      const link = readlinkSync(absolute);
      if (nodePath.isAbsolute(link))
        throw new Error(`Absolute dependency link is unsupported: ${path}`);
      const destination = nodePath.resolve(nodePath.dirname(absolute), link);
      let existing = destination;
      while (!existsSync(existing)) existing = nodePath.dirname(existing);
      const resolved = realpathSync(existing);
      const target = nodePath.relative(base, resolved);
      if (target.startsWith('..') || nodePath.isAbsolute(target)) {
        throw new Error(`Dependency link escapes the candidate: ${path}`);
      }
      entries.push([path, `link:${link}`]);
    } else if (info.isDirectory()) {
      const children = readdirSync(absolute).toSorted((left, right) => left.localeCompare(right));
      for (const child of children) {
        visit(nodePath.join(path, child));
      }
    } else if (info.isFile()) {
      entries.push([path, `${info.mode & 0o111}:${digest(readFileSync(absolute))}`]);
    } else throw new Error(`Unsupported dependency input ${path}`);
  }
  visit(relative);
  return digest(canonical(entries));
}

export function dependencyRoots(root: string): string[] {
  const manifests = git(root, ['ls-files', '-z'])
    .split('\0')
    .filter(path => /^packages\/[^/]+\/package\.json$/u.test(path));
  return [
    'node_modules',
    ...manifests.map(path => nodePath.join(nodePath.dirname(path), 'node_modules')),
  ].filter(path => existsSync(nodePath.join(root, path)));
}

export function dependencyIdentity(root: string): Record<string, string> {
  if (!existsSync(nodePath.join(root, 'node_modules'))) {
    throw new Error(
      'Installed dependencies are missing; run scripts/dev bun install --frozen-lockfile',
    );
  }
  return Object.fromEntries(
    dependencyRoots(root).map(path => [`dependency:${path}`, treeIdentity(root, path)]),
  );
}
