// Safeword: replan-on-resume I/O shell (ticket 153, design B).
//
// Gathers the active ticket's staleness window + referenced paths, the commits
// since, and the current HEAD, then delegates the surface decision to the pure
// core in replan-relevance.ts. Returns the opt-in heads-up line to inject plus
// the HEAD to record (so it fires at most once per HEAD advance), or null to
// stay silent. Never throws: any git/fs failure degrades to silence — for a
// drift-catcher a false negative is harmless, but a crash in a prompt hook is
// not.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

// `.js` specifier (bun resolves it to the .ts source) so tsc accepts this
// module when the test suite pulls it into the typecheck graph — matches the
// `./checkbox-transitions.js` precedent for a tested hook importing a sibling.
import {
  type BlockerTarget,
  decideReplan,
  detectMovedBlockers,
  extractReferencedPaths,
  formatBlockerMovedHeadsUp,
  formatReplanHeadsUp,
  parseGitLogNameOnly,
} from './replan-relevance.js';
import { resolveNamespaceRoot } from './namespace-root.js';

/** Ticket artifacts whose prose names the paths the ticket cares about. */
const ARTIFACT_FILES = ['ticket.md', 'spec.md', 'test-definitions.md'];

export interface ReplanResult {
  /** The heads-up line to inject (already prefixed-free; caller adds bullet). */
  line: string;
  /** Current HEAD sha to record as prompted, suppressing re-fire until it moves. */
  headSha: string;
}

// execFileSync (not execSync) — runs git directly with no shell, so the
// file-derived `last_modified` value passed to `--since` can't break out into
// shell metacharacters. The value comes from ticket.md frontmatter, which in a
// shared repo may originate from an untrusted PR; this hook auto-fires on
// UserPromptSubmit, so a shell would be a command-injection sink.
function runGit(arguments_: readonly string[], cwd: string): string {
  try {
    return execFileSync('git', arguments_, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return '';
  }
}

/** The textual relevance signal: paths named across the ticket's artifacts. */
function readReferencedPaths(ticketDirectory: string): string[] {
  const artifactText = ARTIFACT_FILES.map(name => {
    const filePath = nodePath.join(ticketDirectory, name);
    return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  }).join('\n');
  return extractReferencedPaths(artifactText);
}

/** Parse a `depends_on` frontmatter scalar (`[A, B]` or `A, B`) into ids. Inlined
 * rather than imported from src/utils/ticket-relations because hooks are
 * standalone — they ship into customer projects and can't reach the CLI source. */
function parseDependsOn(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  return raw
    .trim()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
}

/**
 * Resolve `depends_on` ids to BlockerTargets (current status + repo-relative
 * ticket.md path). Ids that don't resolve to a ticket folder are skipped —
 * dangling refs stay silent, mirroring the tolerant ID resolution elsewhere.
 */
function resolveBlockerTargets(projectDirectory: string, ids: readonly string[]): BlockerTarget[] {
  if (ids.length === 0) return [];
  const ticketsRoot = nodePath.join(resolveNamespaceRoot(projectDirectory), 'tickets');
  let folders: string[];
  try {
    folders = readdirSync(ticketsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch {
    return [];
  }

  const targets: BlockerTarget[] = [];
  for (const id of ids) {
    const folder = folders.find(name => name === id || name.startsWith(`${id}-`));
    if (folder === undefined) continue;
    let text: string;
    try {
      text = readFileSync(nodePath.join(ticketsRoot, folder, 'ticket.md'), 'utf8');
    } catch {
      continue;
    }
    targets.push({
      id,
      slug: text.match(/^slug:\s*(.+)$/m)?.[1]?.trim() ?? folder,
      status: text.match(/^status:\s*(.+)$/m)?.[1]?.trim() ?? '',
      ticketPath: nodePath.relative(
        projectDirectory,
        nodePath.join(ticketsRoot, folder, 'ticket.md'),
      ),
    });
  }
  return targets;
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
  promptedHead?: string,
): ReplanResult | null {
  try {
    if (ticketType === 'epic') return null;

    const ticketDirectory = nodePath.join(
      resolveNamespaceRoot(projectDirectory),
      'tickets',
      ticketFolder,
    );
    const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
    if (!existsSync(ticketPath)) return null;

    const ticketContent = readFileSync(ticketPath, 'utf8');
    const lastModified = ticketContent.match(/last_modified:\s*(.+)/)?.[1]?.trim();
    if (!lastModified) return null;

    const dependsOnIds = parseDependsOn(ticketContent.match(/^depends_on:\s*(.+)$/m)?.[1]);
    const referencedPaths = readReferencedPaths(ticketDirectory);
    // No relevance signal at all (no referenced paths AND no depends_on) → stay quiet.
    if (referencedPaths.length === 0 && dependsOnIds.length === 0) return null;

    const headSha = runGit(['rev-parse', 'HEAD'], projectDirectory).trim();
    if (headSha === '') return null;
    // Fire at most once per HEAD advance — dedup BOTH signals here.
    if (headSha === promptedHead) return null;

    const commits = parseGitLogNameOnly(
      runGit(
        ['log', `--since=${lastModified}`, '--name-only', '--pretty=format:%x1f%H'],
        projectDirectory,
      ),
    );

    const pathDecision = decideReplan({
      ticketType,
      headSha,
      promptedHead,
      referencedPaths,
      commits,
    });
    const movedBlockers = detectMovedBlockers(
      resolveBlockerTargets(projectDirectory, dependsOnIds),
      commits,
    );

    const lines: string[] = [];
    if (pathDecision.surface) lines.push(formatReplanHeadsUp(pathDecision.relevantCommitCount));
    if (movedBlockers.length > 0) lines.push(formatBlockerMovedHeadsUp(movedBlockers));
    if (lines.length === 0) return null;

    return { line: lines.join('\n'), headSha };
  } catch {
    return null; // never let a drift-catcher crash the prompt hook
  }
}
