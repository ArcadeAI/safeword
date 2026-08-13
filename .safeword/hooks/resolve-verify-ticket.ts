#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { getTicketInfo } from './lib/active-ticket.ts';
import { resolveNamespaceRoot } from './lib/namespace-root.ts';
import { readSessionState } from './lib/quality-state.ts';
import { resolveRunIdentity, type RunIdentity } from './lib/run-identity.ts';

export type VerifyTicketResolution =
  | { state: 'resolved'; ticketPath: string; source: 'explicit' | 'session' | 'diff' }
  | { state: 'none' }
  | { state: 'error'; message: string; candidates?: string[] };

interface ResolveVerifyTicketOptions {
  env?: NodeJS.ProcessEnv;
  explicitTicket?: string;
}

type ChangedPathsResult =
  { state: 'available'; paths: string[] } | { state: 'error'; message: string; fatal?: boolean };

const DEFAULT_BASE_REFS = [
  'refs/remotes/origin/HEAD',
  'refs/remotes/origin/main',
  'refs/remotes/origin/master',
  'refs/heads/main',
  'refs/heads/master',
] as const;
const USAGE = 'Usage: resolve-verify-ticket.ts [project-directory] [--ticket <id>]';

function runGit(projectDirectory: string, args: string[]): { status: number; stdout: string } {
  const result = spawnSync('git', ['-C', projectDirectory, ...args], {
    encoding: 'utf8',
  });
  return { status: result.status ?? 1, stdout: result.stdout ?? '' };
}

function resolveTicketId(
  projectDirectory: string,
  ticketId: string,
  source: 'explicit' | 'session',
): VerifyTicketResolution {
  const ticket = getTicketInfo(projectDirectory, ticketId);
  if (!ticket.folder) {
    return { state: 'error', message: `${source}-bound ticket "${ticketId}" not found` };
  }
  const ticketPath = nodePath.join(
    resolveNamespaceRoot(projectDirectory),
    'tickets',
    ticket.folder,
    'ticket.md',
  );
  if (!existsSync(ticketPath)) {
    return { state: 'error', message: `${source}-bound ticket "${ticketId}" not found` };
  }
  return {
    state: 'resolved',
    source,
    ticketPath,
  };
}

function sessionTicketId(projectDirectory: string, identity: RunIdentity): string | undefined {
  return readSessionState(projectDirectory, identity)?.activeTicket ?? undefined;
}

function nulSeparated(output: string): string[] {
  return output.split('\0').filter(Boolean);
}

function addNulSeparatedPaths(target: Set<string>, output: string): void {
  for (const path of nulSeparated(output)) target.add(path);
}

function changedPaths(projectDirectory: string): ChangedPathsResult {
  const insideWorktree = runGit(projectDirectory, ['rev-parse', '--is-inside-work-tree']);
  if (insideWorktree.status !== 0 || insideWorktree.stdout.trim() !== 'true') {
    return { state: 'available', paths: [] };
  }

  const paths = new Set<string>();
  const hasHead = runGit(projectDirectory, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']);

  if (hasHead.status === 0) {
    const baseRef = DEFAULT_BASE_REFS.find(
      candidate =>
        runGit(projectDirectory, ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`])
          .status === 0,
    );
    if (baseRef === undefined) {
      return {
        state: 'error',
        message:
          'Unable to determine the current-work Git base; fetch the default branch or pass --ticket <id>',
      };
    }
    const mergeBase = runGit(projectDirectory, ['merge-base', 'HEAD', baseRef]);
    if (mergeBase.status !== 0 || mergeBase.stdout.trim() === '') {
      return {
        state: 'error',
        message:
          'Unable to determine the current-work Git merge base; fetch the default branch or pass --ticket <id>',
      };
    }
    const committed = runGit(projectDirectory, [
      'diff',
      '--relative',
      '--name-only',
      '-z',
      `${mergeBase.stdout.trim()}...HEAD`,
    ]);
    if (committed.status !== 0) {
      return { state: 'error', message: 'Unable to read committed current-work Git changes' };
    }
    addNulSeparatedPaths(paths, committed.stdout);

    const working = runGit(projectDirectory, ['diff', '--relative', '--name-only', '-z', 'HEAD']);
    if (working.status !== 0) {
      return { state: 'error', message: 'Unable to read working-tree Git changes' };
    }
    addNulSeparatedPaths(paths, working.stdout);
  } else {
    const staged = runGit(projectDirectory, ['diff', '--cached', '--name-only', '-z']);
    if (staged.status !== 0) {
      return { state: 'error', message: 'Unable to read staged Git changes' };
    }
    addNulSeparatedPaths(paths, staged.stdout);
  }

  const untracked = runGit(projectDirectory, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (untracked.status !== 0) {
    return { state: 'error', message: 'Unable to read untracked Git changes' };
  }
  addNulSeparatedPaths(paths, untracked.stdout);
  return { state: 'available', paths: [...paths] };
}

function matchingTicketPaths(projectDirectory: string, prefix: string, paths: string[]): string[] {
  return paths
    .filter(path => path.startsWith(prefix) && path.endsWith('/ticket.md'))
    .map(path => nodePath.resolve(projectDirectory, path))
    .sort();
}

function changedTicketPaths(projectDirectory: string): ChangedPathsResult {
  const namespaceRoot = resolveNamespaceRoot(projectDirectory);
  const namespaceRelative = nodePath.relative(projectDirectory, namespaceRoot);
  if (namespaceRelative.startsWith('..') || nodePath.isAbsolute(namespaceRelative)) {
    return { state: 'available', paths: [] };
  }

  const normalizedNamespace = namespaceRelative.split(nodePath.sep).join('/');
  const prefix = normalizedNamespace === '' ? 'tickets/' : `${normalizedNamespace}/tickets/`;
  const changed = changedPaths(projectDirectory);
  if (changed.state === 'error') return changed;
  const ticketPaths = matchingTicketPaths(projectDirectory, prefix, changed.paths);
  const deletedTicketPaths = ticketPaths.filter(path => !existsSync(path));
  if (deletedTicketPaths.length > 0) {
    return {
      state: 'error',
      fatal: true,
      message: `Current-work ticket file was deleted; restore it or pass --ticket <id>: ${deletedTicketPaths.join(', ')}`,
    };
  }
  return {
    state: 'available',
    paths: ticketPaths,
  };
}

export function resolveVerifyTicket(
  projectDirectory: string,
  options: ResolveVerifyTicketOptions = {},
): VerifyTicketResolution {
  const absoluteProject = nodePath.resolve(projectDirectory);
  if (options.explicitTicket?.trim()) {
    return resolveTicketId(absoluteProject, options.explicitTicket.trim(), 'explicit');
  }

  const identity = resolveRunIdentity({}, { env: options.env ?? process.env });
  const boundTicketId =
    identity.sessionKey === null ? undefined : sessionTicketId(absoluteProject, identity);
  const sessionResolution =
    boundTicketId === undefined
      ? undefined
      : resolveTicketId(absoluteProject, boundTicketId, 'session');

  const changed = changedTicketPaths(absoluteProject);
  if (changed.state === 'error') {
    return !changed.fatal && sessionResolution?.state === 'resolved' ? sessionResolution : changed;
  }
  const candidates = changed.paths;
  if (sessionResolution?.state === 'resolved') {
    if (candidates.length === 0) return sessionResolution;
    const conflicts = candidates.filter(candidate => candidate !== sessionResolution.ticketPath);
    if (conflicts.length === 0) return sessionResolution;
    return {
      state: 'error',
      message:
        'Session-bound ticket conflicts with current-work ticket candidates; pass --ticket <id> to disambiguate',
      candidates: [sessionResolution.ticketPath, ...conflicts].sort(),
    };
  }
  if (sessionResolution?.state === 'error' && candidates.length === 0) {
    return { state: 'none' };
  }

  if (candidates.length === 0) return { state: 'none' };
  if (candidates.length === 1) {
    return { state: 'resolved', source: 'diff', ticketPath: candidates[0] as string };
  }
  return {
    state: 'error',
    message: 'Multiple current-work ticket candidates found; pass --ticket <id> to disambiguate',
    candidates,
  };
}

function parseArguments(args: string[]): {
  projectDirectory: string;
  explicitTicket?: string;
  error?: string;
} {
  if (args[0] === '--ticket') {
    if (args.length === 2 && args[1]?.trim()) {
      return { projectDirectory: process.cwd(), explicitTicket: args[1] };
    }
    return {
      projectDirectory: process.cwd(),
      error: USAGE,
    };
  }
  if (args[0]?.startsWith('--')) {
    return { projectDirectory: process.cwd(), error: USAGE };
  }
  const projectDirectory = args[0] ?? process.cwd();
  if (args.length <= 1) return { projectDirectory };
  if (args.length === 3 && args[1] === '--ticket' && args[2]?.trim()) {
    return { projectDirectory, explicitTicket: args[2] };
  }
  return {
    projectDirectory,
    error: USAGE,
  };
}

if (import.meta.main) {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.error !== undefined) {
    process.stderr.write(`${parsed.error}\n`);
    process.exit(1);
  }

  const result = resolveVerifyTicket(parsed.projectDirectory, {
    env: process.env,
    explicitTicket: parsed.explicitTicket,
  });
  if (result.state === 'resolved') {
    process.stdout.write(`${result.ticketPath}\n`);
  } else if (result.state === 'none') {
    process.stderr.write('No current-work ticket found; continue without an active ticket.\n');
  } else {
    process.stderr.write(`${result.message}\n`);
    for (const candidate of result.candidates ?? []) process.stderr.write(`${candidate}\n`);
    process.exit(1);
  }
}
