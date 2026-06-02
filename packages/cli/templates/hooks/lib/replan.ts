// Safeword: replan-on-resume I/O shell (ticket 153, design B).
//
// Gathers the active ticket's staleness window + referenced paths, the commits
// since, and the current HEAD, then delegates the surface decision to the pure
// core in replan-relevance.ts. Returns the opt-in heads-up line to inject plus
// the HEAD to record (so it fires at most once per HEAD advance), or null to
// stay silent. Never throws: any git/fs failure degrades to silence — for a
// drift-catcher a false negative is harmless, but a crash in a prompt hook is
// not.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import {
  decideReplan,
  extractReferencedPaths,
  formatReplanHeadsUp,
  parseGitLogNameOnly,
} from './replan-relevance.ts';

/** Ticket artifacts whose prose names the paths the ticket cares about. */
const ARTIFACT_FILES = ['ticket.md', 'spec.md', 'test-definitions.md'];

export interface ReplanResult {
  /** The heads-up line to inject (already prefixed-free; caller adds bullet). */
  line: string;
  /** Current HEAD sha to record as prompted, suppressing re-fire until it moves. */
  headSha: string;
}

function runGit(arguments_: string, cwd: string): string {
  try {
    return execSync(`git ${arguments_}`, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return '';
  }
}

/**
 * Decide whether to surface the replan heads-up for the active ticket. Reads
 * the ticket's `last_modified` (the staleness baseline), the paths its
 * artifacts reference, and the commits since — then asks the pure core. Returns
 * null (silent) when: epic, ticket file missing, no `last_modified`, no
 * referenced paths (no signal), HEAD unresolved, or no relevant drift.
 */
export function evaluateReplan(
  projectDirectory: string,
  ticketFolder: string,
  ticketType: string | undefined,
  promptedHead: string | undefined,
): ReplanResult | null {
  try {
    if (ticketType === 'epic') return null;

    const ticketDirectory = nodePath.join(
      projectDirectory,
      '.safeword-project',
      'tickets',
      ticketFolder,
    );
    const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
    if (!existsSync(ticketPath)) return null;

    const lastModified = readFileSync(ticketPath, 'utf8')
      .match(/last_modified:\s*(.+)/)?.[1]
      ?.trim();
    if (!lastModified) return null;

    const artifactText = ARTIFACT_FILES.map(name => {
      const filePath = nodePath.join(ticketDirectory, name);
      return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    }).join('\n');
    const referencedPaths = extractReferencedPaths(artifactText);
    if (referencedPaths.length === 0) return null; // no signal → bias quiet

    const headSha = runGit('rev-parse HEAD', projectDirectory).trim();
    if (headSha === '') return null;

    const commits = parseGitLogNameOnly(
      runGit(`log --since="${lastModified}" --name-only --pretty=format:%x1f%H`, projectDirectory),
    );

    const decision = decideReplan({
      ticketType,
      headSha,
      promptedHead,
      referencedPaths,
      commits,
    });
    if (!decision.surface) return null;

    return { line: formatReplanHeadsUp(decision.relevantCommitCount), headSha };
  } catch {
    return null; // never let a drift-catcher crash the prompt hook
  }
}
