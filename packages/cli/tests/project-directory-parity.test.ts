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

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const SCANNED = ['templates/hooks', 'templates/scripts', 'src'];
const RESOLVER = 'templates/hooks/lib/project-directory.ts';
const LAUNCH_VARIABLE = 'CLAUDE_PROJECT_DIR';
const GIT_TOPLEVEL = '--show-toplevel';
const PROJECT_MARKERS = new Set(['.git', '.safeword', 'SAFEWORD.md']);

/**
 * Whether `source` picks a project on its own, by any route the design names:
 * it reads the launch-checkout variable (property, element or destructuring
 * access; writing a child environment is not a read), falls back to
 * `process.cwd()` as a root (`x ?? process.cwd()`), walks up looking for a
 * `.git`/`.safeword` marker, or asks git for its toplevel. Parsed, not matched
 * as text, so comments never count. A tripwire, not a sandbox: a computed key
 * built at runtime can still slip past.
 */
function readsProjectChoice(source: string, fileName = 'scan.ts'): boolean {
  const scriptKind = /\.[cm]?js$/.test(fileName) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (choosesProject(node)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

function choosesProject(node: ts.Node): boolean {
  if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
    return node.text.includes(GIT_TOPLEVEL) || walksForMarker(node);
  }
  return readsLaunchVariable(node) || fallsBackToProcessCwd(node);
}

/** `x ?? process.cwd()` / `x || process.cwd()`: the process cwd as a root default. */
function fallsBackToProcessCwd(node: ts.Node): boolean {
  if (!ts.isBinaryExpression(node)) return false;
  const operator = node.operatorToken.kind;
  if (operator !== ts.SyntaxKind.QuestionQuestionToken && operator !== ts.SyntaxKind.BarBarToken) {
    return false;
  }
  const fallback = node.right;
  return (
    ts.isCallExpression(fallback) &&
    fallback.arguments.length === 0 &&
    fallback.expression.getText() === 'process.cwd'
  );
}

/** A `.git`/`.safeword` marker named inside a loop: a hand-rolled walk-up. */
function walksForMarker(node: ts.StringLiteralLike | ts.TemplateLiteralToken): boolean {
  if (!PROJECT_MARKERS.has(node.text)) return false;
  for (let parent = node.parent; !ts.isSourceFile(parent); parent = parent.parent) {
    if (ts.isIterationStatement(parent, false)) return true;
    if (ts.isFunctionLike(parent)) return false;
  }
  return false;
}

function readsLaunchVariable(node: ts.Node): boolean {
  if (ts.isBindingElement(node)) return namesLaunchVariable(node.propertyName ?? node.name);
  if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
    // `({ CLAUDE_PROJECT_DIR: launch } = process.env)` destructures by assignment.
    return namesLaunchVariable(node.name) && isWriteTarget(node.parent);
  }
  if (ts.isPropertyAccessExpression(node)) {
    return namesLaunchVariable(node.name) && !isWriteTarget(node);
  }
  if (ts.isElementAccessExpression(node)) {
    return namesLaunchVariable(node.argumentExpression) && !isWriteTarget(node);
  }
  return false;
}

function namesLaunchVariable(key: ts.Node): boolean {
  return (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) && key.text === LAUNCH_VARIABLE;
}

function isWriteTarget(node: ts.Expression): boolean {
  const parent = node.parent;
  if (ts.isDeleteExpression(parent)) return true;
  return (
    ts.isBinaryExpression(parent) &&
    parent.left === node &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
  );
}

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
  'src/commands/project-pr-ready.ts':
    'PR Ready acts on the git worktree it is invoked in (or --cwd), by design',
  'src/go-lint/config.ts': "mirrors golangci-lint's own gitroot relative-path-mode",
  'src/presets/typescript/eslint-configs/base.ts':
    "the self-contained ESLint preset runs inside the user's project and reads its .safeword/config.json for a relocated BDD lane",
  'src/utils/project-detector.ts':
    'stops the installed-compiler lookup at the repository root of an already-chosen project',
  'templates/hooks/lib/re-entry.ts':
    're-entry hooks keep their own git-root anchor: they follow the host cwd into a worktree and work in unenrolled repositories by design',
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
  'src/claude-plugin/runtime/dispatch.ts': 'PR 4',
  'src/codex-plugin/operations.ts': 'PR 4',
  'src/tracker-connect/run.ts': 'PR 4',
  // Skill helper scripts: an explicit project argument, else the process cwd.
  'templates/hooks/audit-principle-trace.ts': 'PR 4',
  'templates/hooks/dependency-bootstrap.ts': 'PR 4',
  'templates/hooks/record-skill-invocation.ts': 'PR 4',
  'templates/hooks/resolve-namespace-root.ts': 'PR 4',
  'templates/hooks/resolve-project-knowledge.ts': 'PR 4',
  'templates/hooks/resolve-verify-ticket.ts': 'PR 4',
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

const choosers = SCANNED.flatMap(sourceFiles)
  .filter(path => path !== RESOLVER)
  .filter(path => readsProjectChoice(readFileSync(nodePath.join(packageRoot, path), 'utf8'), path))
  .toSorted((left, right) => left.localeCompare(right));
const allowlisted = new Set([...Object.keys(LEGITIMATE), ...Object.keys(PENDING)]);

describe('project directory parity (#5467)', () => {
  it('picks the project only through project-directory.ts', () => {
    const unexplained = choosers.filter(path => !allowlisted.has(path));
    expect(unexplained, 'resolve the project with resolveProjectDirectory()').toEqual([]);
  });

  it.each([
    'const launch = process.env.CLAUDE_PROJECT_DIR;',
    'const launch = process.env?.CLAUDE_PROJECT_DIR ?? cwd;',
    "const launch = process.env['CLAUDE_PROJECT_DIR'];",
    'const { CLAUDE_PROJECT_DIR } = process.env;',
    'const { HOME, CLAUDE_PROJECT_DIR: launch } = process.env;',
    'const env = process.env; use(env.CLAUDE_PROJECT_DIR);',
    '({ CLAUDE_PROJECT_DIR: launch } = process.env);',
    "spawnSync('git', ['rev-parse', '--show-toplevel']);",
    'run(`git rev-parse --show-toplevel`);',
    'const project = process.argv[2] ?? process.cwd();',
    'const project = options.cwd || process.cwd();',
    "while (dir !== '/') { if (existsSync(join(dir, '.git'))) break; dir = dirname(dir); }",
    "for (let d = start; ; d = dirname(d)) if (existsSync(join(d, '.safeword'))) return d;",
  ])('counts %s as a project choice', source => {
    expect(readsProjectChoice(source)).toBe(true);
  });

  it.each([
    'env.CLAUDE_PROJECT_DIR = workspace;',
    'delete env.CLAUDE_PROJECT_DIR;',
    'spawn(cmd, { env: { ...process.env, CLAUDE_PROJECT_DIR: workspace } });',
    '// git rev-parse --show-toplevel picks the launch checkout',
    '/* process.env.CLAUDE_PROJECT_DIR stays at the launch checkout */',
    'const project = resolveProjectDirectory({ cwd: process.cwd() });',
    "const marker = join(project, '.safeword');",
    "for (const entry of entries) seen.add(entry); const ignored = ['.git'];",
  ])('does not count %s', source => {
    expect(readsProjectChoice(source)).toBe(false);
  });

  it('keeps the allowlists current', () => {
    const stale = [...allowlisted].filter(path => !choosers.includes(path));
    expect(stale, 'delete allowlist entries for migrated files').toEqual([]);
  });
});
