// Safeword: Git-backed provenance for feature artifacts and inspiration activation.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parseFrontmatter } from './hierarchy.js';
import { hasInspirationActivationCandidate } from './inspiration.js';

export type InspirationProvenance = 'activated' | 'absent' | 'unavailable';
export type SpecArtifactProvenance = 'present' | 'absent' | 'unavailable';

interface HistoricalFileTrail {
  commits: Set<string>;
  paths: Set<string>;
}

function git(ticketDirectory: string, args: string[], stderr: 'ignore' | 'pipe' = 'ignore') {
  return spawnSync('git', args, {
    cwd: ticketDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', stderr],
  });
}

function repositoryState(ticketDirectory: string): 'repository' | 'absent' | 'unavailable' {
  const result = git(ticketDirectory, ['rev-parse', '--is-inside-work-tree'], 'pipe');
  if (result.error !== undefined) return 'unavailable';
  if (result.status === 0) return 'repository';
  return (result.stderr ?? '').includes('not a git repository') ? 'absent' : 'unavailable';
}

function absentOrIncompleteHistory(ticketDirectory: string): 'absent' | 'unavailable' {
  const shallow = git(ticketDirectory, ['rev-parse', '--is-shallow-repository']);
  if (shallow.error !== undefined || shallow.status !== 0) return 'unavailable';
  return (shallow.stdout ?? '').trim() === 'true' ? 'unavailable' : 'absent';
}

function historicalFileTrail(
  ticketDirectory: string,
  repositoryPrefix: string,
  fileName: 'ticket.md' | 'spec.md',
): HistoricalFileTrail | undefined {
  const history = git(ticketDirectory, ['log', '--all', '--follow', '--format=%H', '--', fileName]);
  if (history.error !== undefined || history.status !== 0) return undefined;

  const names = git(ticketDirectory, [
    'log',
    '--all',
    '--follow',
    '--name-status',
    '--format=',
    '--',
    fileName,
  ]);
  if (names.error !== undefined || names.status !== 0) return undefined;

  const paths = new Set([`${repositoryPrefix}${fileName}`]);
  for (const line of (names.stdout ?? '').split(/\r?\n/)) {
    const [, firstPath, secondPath] = line.split('\t');
    if (firstPath !== undefined && firstPath !== '') paths.add(firstPath);
    if (secondPath !== undefined && secondPath !== '') paths.add(secondPath);
  }
  return {
    commits: new Set((history.stdout ?? '').split(/\r?\n/).filter(Boolean)),
    paths,
  };
}

function readHistoricalVersion(
  ticketDirectory: string,
  commit: string,
  paths: Set<string>,
): string | undefined {
  for (const path of paths) {
    const version = git(ticketDirectory, ['show', `${commit}:${path}`]);
    if (version.error !== undefined) return undefined;
    if (version.status === 0) return version.stdout ?? '';
  }
  return '';
}

function historicalInspirationContractWasActivated(
  ticketDirectory: string,
  repositoryPrefix: string,
): boolean | undefined {
  const ticketTrail = historicalFileTrail(ticketDirectory, repositoryPrefix, 'ticket.md');
  const specTrail = historicalFileTrail(ticketDirectory, repositoryPrefix, 'spec.md');
  if (ticketTrail === undefined || specTrail === undefined) return undefined;

  const commits = new Set([...ticketTrail.commits, ...specTrail.commits]);
  for (const commit of commits) {
    const ticketContent = readHistoricalVersion(ticketDirectory, commit, ticketTrail.paths);
    const specContent = readHistoricalVersion(ticketDirectory, commit, specTrail.paths);
    if (ticketContent === undefined || specContent === undefined) return undefined;
    if (hasInspirationActivationCandidate({ ticketContent, specContent })) return true;
  }
  return false;
}

/** A current phase anchor or Git history proves that this feature owns spec.md. */
export function specArtifactProvenance(ticketDirectory: string): SpecArtifactProvenance {
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  const specPath = nodePath.join(ticketDirectory, 'spec.md');
  if (existsSync(specPath)) return 'present';

  const ticketContent = existsSync(ticketPath) ? readFileSync(ticketPath, 'utf8') : '';
  const frontmatterMatch = ticketContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const meta = parseFrontmatter(frontmatterMatch?.[1] ?? '');
  const anchors = meta.phase_anchors;
  if (
    Array.isArray(anchors) &&
    anchors.some(entry => {
      const colon = entry.indexOf(':');
      if (colon === -1) return false;
      const anchoredPath = entry
        .slice(colon + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      return anchoredPath.split('/').at(-1) === 'spec.md';
    })
  ) {
    return 'present';
  }

  const repository = repositoryState(ticketDirectory);
  if (repository !== 'repository') return repository;

  const history = git(ticketDirectory, [
    'log',
    '--all',
    '--follow',
    '--format=%H',
    '--',
    'spec.md',
  ]);
  if (history.error !== undefined || history.status !== 0) return 'unavailable';
  if ((history.stdout ?? '').trim() !== '') return 'present';
  return absentOrIncompleteHistory(ticketDirectory);
}

/** Git history is durable activation provenance once any scaffold signal is committed. */
export function inspirationContractProvenance(ticketDirectory: string): InspirationProvenance {
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  const specPath = nodePath.join(ticketDirectory, 'spec.md');
  const currentTicket = existsSync(ticketPath) ? readFileSync(ticketPath, 'utf8') : '';
  const currentSpec = existsSync(specPath) ? readFileSync(specPath, 'utf8') : '';
  if (
    hasInspirationActivationCandidate({ ticketContent: currentTicket, specContent: currentSpec })
  ) {
    return 'activated';
  }

  const repository = repositoryState(ticketDirectory);
  if (repository !== 'repository') return repository;

  // Git canonicalizes macOS's /var → /private/var alias. Asking Git for the
  // repository-relative prefix avoids constructing a false cross-root path.
  const prefix = git(ticketDirectory, ['rev-parse', '--show-prefix']);
  if (prefix.error !== undefined || prefix.status !== 0) return 'unavailable';

  const activated = historicalInspirationContractWasActivated(
    ticketDirectory,
    (prefix.stdout ?? '').trim(),
  );
  if (activated === undefined) return 'unavailable';
  if (activated) return 'activated';
  return absentOrIncompleteHistory(ticketDirectory);
}
