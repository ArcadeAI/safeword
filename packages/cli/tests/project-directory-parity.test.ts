/**
 * Parity guard for #5467: every hook, script and CLI command picks its project
 * through `templates/hooks/lib/project-directory.ts`. Reading
 * `CLAUDE_PROJECT_DIR` or asking git for the toplevel anywhere else is how
 * worktree sessions ended up reading one checkout and writing another.
 *
 * `LEGITIMATE` names the uses that are not a project choice. `PENDING` names
 * files not yet migrated; it may only shrink — an entry that no longer matches
 * fails too, so finishing a migration means deleting its line.
 */

import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const SCANNED = ['templates/hooks', 'templates/scripts', 'src'];
const RESOLVER = 'templates/hooks/lib/project-directory.ts';

// A read of the launch-checkout variable (assignment into a child env is not a
// read), or git's toplevel, which is the launch checkout's view of a worktree
// only by accident.
const PROJECT_CHOICE =
  /\.CLAUDE_PROJECT_DIR\b(?!\s*=[^=])|\[['"]CLAUDE_PROJECT_DIR['"]\]|--show-toplevel/;

const LEGITIMATE: Record<string, string> = {
  'src/utils/git.ts': 'gitToplevel() serves git operations, not project choice',
  'src/commands/architecture.ts': 'git context for staging architecture documents',
  'src/review/retrospective-proof.ts': 'git repository identity for proof records',
  'src/codex-plugin/inventory.ts': 'Codex hook launcher locates hook scripts in the git tree',
  'src/codex-plugin/project-bootstrap.ts':
    'dependency bootstrap runs in the git tree it is invoked in',
  'templates/hooks/pre-tool-architecture-stage.ts':
    'git toplevel of the commit target, after the shell cwd is resolved',
  'templates/hooks/lib/self-report.ts':
    'detectAgent checks whether the variable is set, to name the host',
};

const PENDING: Record<string, string> = {
  // Retro spool and closeout binding (#5467 PR 3).
  'templates/hooks/stop-retro.ts': 'PR 3',
  'templates/hooks/prompt-retro-nudge.ts': 'PR 3',
  'templates/hooks/stop-retro-filing.ts': 'PR 3',
  'templates/scripts/closeout-cleanup.ts': 'PR 3',
  'src/commands/retro.ts': 'PR 3',
  // CLI resolvers and the Codex/Cursor adapters (#5467 PR 4).
  'templates/hooks/run-review.ts': 'PR 4',
  'templates/hooks/codex/pre-tool-quality.ts': 'PR 4',
  'templates/hooks/codex/pre-tool-quality-helpers.ts': 'PR 4',
  'templates/hooks/codex/stop.ts': 'PR 4',
  'templates/hooks/lib/safeword-context.ts': 'PR 4',
  'templates/hooks/cursor/gate-adapter.ts': 'PR 4',
  'src/claude-plugin/catalogue.ts': 'PR 4',
  'src/claude-plugin/project-root.ts': 'PR 4',
  'src/codex-plugin/project-directory.ts': 'PR 4',
  'src/commands/codex-hook.ts': 'PR 4',
  'src/commands/project-runtime.ts': 'PR 4',
  'src/self-report-capture.ts': 'PR 4',
};

function sourceFiles(directory: string): string[] {
  return readdirSync(nodePath.join(packageRoot, directory), {
    recursive: true,
    withFileTypes: true,
  })
    .filter(entry => entry.isFile() && /\.[cm]?[jt]s$/.test(entry.name))
    .map(entry =>
      nodePath
        .relative(packageRoot, nodePath.join(entry.parentPath, entry.name))
        .replaceAll('\\', '/'),
    )
    .filter(path => !/\.test\.[cm]?[jt]s$/.test(path) && !path.endsWith('.generated.ts'));
}

// Comments may name the patterns they explain; only code picks a project.
const withoutCommentLines = (source: string) =>
  source
    .split('\n')
    .filter(line => !/^\s*(?:\/\/|\/?\*)/.test(line))
    .join('\n');

const readCode = (path: string) =>
  withoutCommentLines(readFileSync(nodePath.join(packageRoot, path), 'utf8'));

const choosers = SCANNED.flatMap(sourceFiles)
  .filter(path => path !== RESOLVER)
  .filter(path => PROJECT_CHOICE.test(readCode(path)))
  .toSorted((left, right) => left.localeCompare(right));
const allowlisted = new Set([...Object.keys(LEGITIMATE), ...Object.keys(PENDING)]);

describe('project directory parity (#5467)', () => {
  it('picks the project only through project-directory.ts', () => {
    const unexplained = choosers.filter(path => !allowlisted.has(path));
    expect(unexplained, 'resolve the project with resolveProjectDirectory()').toEqual([]);
  });

  it('keeps the allowlists current', () => {
    const stale = [...allowlisted].filter(path => !choosers.includes(path));
    expect(stale, 'delete allowlist entries for migrated files').toEqual([]);
  });
});
