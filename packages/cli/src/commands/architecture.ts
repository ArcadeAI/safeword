/**
 * `safeword architecture` — refresh the generated architecture state document(s)
 * (ticket QD5DTT, Slice 1; FPV0E4, Slice 2; XG9SFP, Slice 3).
 *
 * Default mode is a thin CLI entry over `selfHealProject`: re-extracts the
 * skeleton and reconciles prose markers for every node — one doc for a
 * single-repo, or a derived root index plus colocated per-package leaf docs for a
 * monorepo. The SessionStart hook shells out to it so the heal logic lives in one
 * place.
 *
 * `--check` is the CI backstop: a dry-run that writes nothing and exits non-zero
 * when ANY node is stale (a would-change action), so a silently-wrong doc cannot
 * reach the main branch.
 *
 * `--stage` is the commit-time auto-fix: export the staged git index, regenerate
 * every stale node from that deterministic tree, and `git add` each into the
 * in-flight commit, so unrelated worktree changes cannot contaminate it. Never
 * blocks (always exits zero). `--staged` exposes the same deterministic source
 * without automatically adding the generated docs. The commit and CI gates
 * (`--stage` and `--check`) honor the per-project opt-out
 * (`architectureDocEnforcement: false`); explicit generation modes still run.
 */

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import {
  isWouldChangeAction,
  planSelfHealProject,
  selfHealProject,
  selfHealProjectPreservingProse,
  type SelfHealResult,
} from '../utils/architecture-document.js';
import {
  discoverLeafDirectories,
  discoverUnreadableWorkspaces,
} from '../utils/architecture-monorepo.js';
import { architectureNarrativeDriftAdvisoryForProject } from '../utils/architecture-narrative-drift.js';
import {
  GENERATED_ARCHITECTURE_FILENAME,
  isArchitectureDocumentEnforcementEnabled,
  readConfiguredPath,
  resolveGeneratedArchitecturePath,
} from '../utils/configured-paths.js';
import { readJson, writeJson } from '../utils/fs.js';
import { error, success, warn } from '../utils/output.js';
import { toRepoDirectory } from '../utils/repo-path.js';

export function architecture(
  cwd: string = process.cwd(),
  options: { check?: boolean; stage?: boolean; staged?: boolean } = {},
): Promise<void> {
  if (options.check) {
    return architectureCheck(cwd);
  }
  if (options.stage) {
    return architectureStage(cwd);
  }
  if (options.staged) {
    return architectureStaged(cwd);
  }

  generateFromWorktree(cwd);
  return Promise.resolve();
}

function generateFromWorktree(cwd: string): void {
  const results = selfHealProject(cwd);
  for (const result of results) {
    success(`Architecture state document ${result.action}: ${result.path}`);
  }
  warnUnreadableWorkspaces(cwd);
  warnNarrativeDrift(cwd);
}

/**
 * Print the non-blocking narrative-drift advisory (ticket BY7RNR, GitHub #848):
 * generated `## Packages` entries the human narrative never mentions — the
 * pre-existing-drift case the AXRC4D fingerprint nudge cannot see. Surfaced in
 * every mode (like {@link warnUnreadableWorkspaces}, and independent of
 * `architectureDocEnforcement` for the same reason: honesty about the map is
 * not enforcement) and never changes an exit code — the narrative is
 * human-owned, so only a person can reconcile it.
 */
function warnNarrativeDrift(cwd: string): void {
  const advisory = architectureNarrativeDriftAdvisoryForProject(cwd);
  if (advisory !== undefined) warn(advisory);
}

/**
 * Print a non-blocking warning for each workspace manager that is present at the root but
 * unparseable (ticket UWP4XK, GitHub #558) — a malformed `go.work`, an unreadable Cargo
 * `[workspace] members`, a flow-style `pnpm-workspace.yaml`. Advisory only: it never
 * changes a command's exit code. Surfaced in every mode (default/`--check`/`--stage`),
 * independent of `architectureDocEnforcement`, because coverage honesty is not enforcement
 * — the architecture map silently omitting a whole language is wrong regardless of opt-out.
 */
function warnUnreadableWorkspaces(cwd: string): void {
  for (const workspace of discoverUnreadableWorkspaces(cwd)) {
    warn(
      `Workspace config present but unreadable: ${workspace.config} (${workspace.manager}). Its packages may be missing from the architecture doc — fix the config and re-run \`safeword architecture\`. (Advisory; nothing is blocked.)`,
    );
  }
}

/**
 * Commit-time auto-fix. Regenerates every stale node from the staged git index
 * and stages it into the in-flight commit; leaves current/`noop`/foreign nodes
 * untouched. Never blocks — git failures are swallowed so the commit proceeds.
 */
function architectureStage(cwd: string): Promise<void> {
  try {
    const gitContext = resolveGitContext(cwd);
    if (gitContext === undefined) {
      warn('No Git worktree found; generated from the worktree instead without auto-staging.');
      generateFromWorktree(cwd);
      return Promise.resolve();
    }

    withGitIndexSnapshot(cwd, gitContext, snapshotDirectory => {
      warnUnreadableWorkspaces(snapshotDirectory);
      if (!isArchitectureDocumentEnforcementEnabled(cwd)) {
        success('Architecture doc enforcement is opted out (architectureDocEnforcement: false).');
        // Coverage honesty is not enforcement (see warnNarrativeDrift): surface
        // drift even when opted out, matching --check and default mode. Read the
        // index snapshot so unstaged source shape cannot affect the commit.
        warnNarrativeDrift(snapshotDirectory);
        return;
      }

      const changed = materializeIndexResults(cwd, snapshotDirectory, 'mutations-only').filter(
        result => isWouldChangeAction(result.action),
      );
      if (changed.length === 0) {
        success('Architecture docs need no change.');
      } else {
        for (const result of changed) {
          try {
            const stageFailure = stageDocument(cwd, result);
            if (stageFailure === undefined) {
              success(`Architecture doc ${result.action} and staged: ${result.path}`);
            } else {
              warn(
                `Architecture doc ${result.action} but could not be staged: ${result.path}. Cause: ${stageFailure}`,
              );
            }
          } finally {
            if (result.restoreWorktreeContent !== undefined) {
              replaceArchitectureDocumentContent(result.restoreWorktreeContent, result.path, cwd);
              warn(`Preserved unstaged worktree architecture edits: ${result.path}`);
            }
          }
        }
      }
      // The snapshot contains the freshly healed document and the exact source
      // tree for this commit, so the advisory has the same provenance.
      warnNarrativeDrift(snapshotDirectory);
    });
    warnExcludedWorktreeInputs(cwd);
  } catch (error_) {
    warn(
      `Could not complete staged-tree architecture generation; nothing was auto-staged. CI will verify freshness. Cause: ${errorMessage(error_)}`,
    );
  }

  return Promise.resolve();
}

/**
 * Explicit deterministic generation mode. It uses the same index snapshot as
 * commit-time auto-staging but leaves the index untouched so developers can
 * inspect the result before choosing what to stage.
 */
function architectureStaged(cwd: string): Promise<void> {
  try {
    const gitContext = resolveGitContext(cwd);
    if (gitContext === undefined) {
      warn('No Git worktree found; generated from the worktree instead.');
      generateFromWorktree(cwd);
      return Promise.resolve();
    }

    withGitIndexSnapshot(cwd, gitContext, snapshotDirectory => {
      warnUnreadableWorkspaces(snapshotDirectory);
      const results = materializeIndexResults(cwd, snapshotDirectory, 'restore-staged-tree');
      for (const result of results) {
        success(`Architecture state document ${result.action}: ${result.path}`);
      }
      warnNarrativeDrift(snapshotDirectory);
    });
    warnExcludedWorktreeInputs(cwd);
  } catch (error_) {
    error(
      `Could not complete staged-tree architecture generation; inspect the worktree before retrying. Cause: ${errorMessage(error_)}`,
    );
    process.exitCode = 1;
  }
  return Promise.resolve();
}

/**
 * Export the stage-zero index into an isolated directory and remove it after
 * the caller finishes. `git checkout-index` reads only the index: unstaged and
 * untracked worktree files never enter the architecture extractor.
 */
function withGitIndexSnapshot<T>(
  cwd: string,
  gitContext: GitContext,
  useSnapshot: (directory: string) => T,
): T {
  const snapshotDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-architecture-index-'));
  try {
    assertNoGitlinks(gitContext);
    execFileSync(
      'git',
      [
        'checkout-index',
        '--all',
        '--force',
        '--ignore-skip-worktree-bits',
        `--prefix=${snapshotDirectory}${nodePath.sep}`,
      ],
      { cwd: gitContext.rootDirectory, stdio: 'ignore' },
    );
    const snapshotProjectDirectory = nodePath.join(
      snapshotDirectory,
      gitContext.projectRelativeDirectory,
    );
    prepareSnapshotProjectRoot(cwd, snapshotProjectDirectory);
    return useSnapshot(snapshotProjectDirectory);
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

const GITLINK_MODE_PREFIX = '160000 ';

/** Refuse a staged tree whose pinned submodule contents cannot be materialized safely. */
function assertNoGitlinks(gitContext: GitContext): void {
  const pathArguments =
    gitContext.projectRelativeDirectory === '' ? [] : [gitContext.projectRelativeDirectory];
  const entries = execFileSync(
    'git',
    ['ls-files', '--stage', '-z', '--full-name', '--', ...pathArguments],
    {
      cwd: gitContext.rootDirectory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  )
    .split('\0')
    .filter(entry => entry.startsWith(GITLINK_MODE_PREFIX));
  if (entries.length === 0) return;

  const paths = entries.map(entry => entry.slice(entry.indexOf('\t') + 1));
  throw new Error(
    `Staged-tree architecture generation does not support submodule gitlinks: ${paths.join(', ')}`,
  );
}

interface GitContext {
  rootDirectory: string;
  projectRelativeDirectory: string;
}

/** Resolve the invocation directory against Git's repository root. */
function resolveGitContext(cwd: string): GitContext | undefined {
  let rootDirectory: string;
  try {
    rootDirectory = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (error_) {
    if ((error_ as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('Git executable is unavailable.', { cause: error_ });
    }
    return undefined;
  }
  if (rootDirectory.length === 0) return undefined;

  const canonicalRoot = realpathSync(rootDirectory);
  const canonicalProject = realpathSync(cwd);
  const projectRelativeDirectory = nodePath.relative(canonicalRoot, canonicalProject);
  if (
    nodePath.isAbsolute(projectRelativeDirectory) ||
    projectRelativeDirectory === '..' ||
    projectRelativeDirectory.startsWith(`..${nodePath.sep}`)
  ) {
    throw new Error('The architecture project directory is outside the Git worktree.');
  }
  return { rootDirectory: canonicalRoot, projectRelativeDirectory };
}

/**
 * Keep a configured project root inside the exported tree before the healer
 * can write through it. Absolute repo-contained paths are remapped into the
 * snapshot; lexical escapes and physical symlink escapes are rejected.
 */
function prepareSnapshotProjectRoot(cwd: string, snapshotDirectory: string): void {
  const configuredRoot = readConfiguredPath(snapshotDirectory, 'projectRoot');
  if (configuredRoot === undefined) return;

  const repoRelativeRoot = toRepoDirectory(cwd, configuredRoot);
  if (repoRelativeRoot === undefined) {
    throw new Error('The staged projectRoot resolves outside the repository.');
  }
  assertPhysicalContainment(snapshotDirectory, nodePath.join(snapshotDirectory, repoRelativeRoot));
  if (!nodePath.isAbsolute(configuredRoot)) return;

  rewriteSnapshotProjectRoot(snapshotDirectory, repoRelativeRoot);
}

function rewriteSnapshotProjectRoot(snapshotDirectory: string, repoRelativeRoot: string): void {
  const configPath = nodePath.join(snapshotDirectory, '.safeword', 'config.json');
  const config = readJson(configPath);
  if (config === undefined || typeof config !== 'object' || config === null) return;
  const paths = (config as { paths?: unknown }).paths;
  if (paths === undefined || typeof paths !== 'object' || paths === null) return;
  writeJson(configPath, {
    ...config,
    paths: {
      ...paths,
      projectRoot: repoRelativeRoot === '' ? '.' : repoRelativeRoot,
    },
  });
}

/**
 * Resolve the nearest existing ancestor so non-existent destination leaves are
 * accepted, while any existing symlink component must resolve inside the
 * allowed root. A dangling symlink is rejected because its physical target
 * cannot be proven safe.
 */
function assertPhysicalContainment(rootDirectory: string, candidatePath: string): void {
  if (toRepoDirectory(rootDirectory, candidatePath) === undefined) {
    throw new Error('The architecture path lexically escapes its allowed root.');
  }

  let existingAncestor = candidatePath;
  for (;;) {
    try {
      lstatSync(existingAncestor);
      break;
    } catch (error_) {
      if ((error_ as NodeJS.ErrnoException).code !== 'ENOENT') throw error_;
      const parent = nodePath.dirname(existingAncestor);
      if (parent === existingAncestor) throw error_;
      existingAncestor = parent;
    }
  }

  const canonicalRoot = realpathSync(rootDirectory);
  const canonicalAncestor = realpathSync(existingAncestor);
  if (toRepoDirectory(canonicalRoot, canonicalAncestor) === undefined) {
    throw new Error('The architecture path physically escapes its allowed root.');
  }
}

/** Validate every path selfHealProject may write before allowing its first write. */
function assertSnapshotHealTargetsContained(snapshotDirectory: string): void {
  const targets = [
    resolveGeneratedArchitecturePath(snapshotDirectory),
    ...discoverLeafDirectories(snapshotDirectory).map(directory =>
      nodePath.join(directory, GENERATED_ARCHITECTURE_FILENAME),
    ),
  ];
  for (const target of targets) {
    assertPhysicalContainment(snapshotDirectory, target);
  }
}

/**
 * Replace through a fresh inode so an existing hard-linked destination cannot
 * mutate another directory entry. The temporary file shares the destination
 * directory, allowing rename to atomically replace symlinks and hard links.
 */
function replaceArchitectureDocumentWith(
  destination: string,
  allowedRoot: string,
  writeTemporaryFile: (path: string) => void,
): void {
  const destinationDirectory = nodePath.dirname(destination);
  mkdirSync(destinationDirectory, { recursive: true });
  assertPhysicalContainment(allowedRoot, destination);

  // Prefer the OS temp root when it is on the destination filesystem: this
  // keeps crash litter outside the repository while preserving atomic rename.
  // Cross-device rename is not atomic, so fall back to an adjacent directory
  // only when the filesystems differ.
  let temporaryDirectory = mkdtempSync(
    nodePath.join(tmpdir(), 'safeword-architecture-replacement-'),
  );
  if (lstatSync(temporaryDirectory).dev !== lstatSync(destinationDirectory).dev) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = mkdtempSync(
      nodePath.join(destinationDirectory, '.safeword-architecture-'),
    );
  }
  try {
    const temporaryPath = nodePath.join(temporaryDirectory, nodePath.basename(destination));
    writeTemporaryFile(temporaryPath);
    renameSync(temporaryPath, destination);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function replaceArchitectureDocument(
  source: string,
  destination: string,
  allowedRoot: string,
): void {
  replaceArchitectureDocumentWith(destination, allowedRoot, temporaryPath => {
    copyFileSync(source, temporaryPath);
  });
}

function replaceArchitectureDocumentContent(
  content: string,
  destination: string,
  allowedRoot: string,
): void {
  replaceArchitectureDocumentWith(destination, allowedRoot, temporaryPath => {
    writeFileSync(temporaryPath, content);
  });
}

type IndexMaterializationMode = 'mutations-only' | 'restore-staged-tree';

interface IndexMaterializationPolicy {
  renderUnchanged: boolean;
  preservePriorStructure: boolean;
  writeUnchanged: boolean;
  captureDivergentContent: boolean;
}

interface MaterializedIndexResult extends SelfHealResult {
  restoreWorktreeContent?: string;
}

type WorktreeDocumentState =
  | { existed: false }
  | {
      existed: true;
      content: string;
    };

interface IndexMaterializationPlan {
  result: SelfHealResult;
  destination: string;
  shouldWrite: boolean;
  priorWorktreeState?: WorktreeDocumentState;
  restoreWorktreeContent?: string;
}

/**
 * Heal inside the index snapshot, then copy only generated mutations to their
 * matching worktree paths. Returned paths always name the real worktree files.
 */
function materializeIndexResults(
  cwd: string,
  snapshotDirectory: string,
  mode: IndexMaterializationMode,
): MaterializedIndexResult[] {
  assertSnapshotHealTargetsContained(snapshotDirectory);
  const policy = indexMaterializationPolicy(mode);
  const plans = planIndexMaterializations(cwd, snapshotDirectory, policy);
  preflightIndexMaterializations(cwd, plans, policy);

  const attemptedPlans: IndexMaterializationPlan[] = [];
  try {
    for (const plan of plans) {
      if (!plan.shouldWrite) continue;
      attemptedPlans.push(plan);
      replaceArchitectureDocument(plan.result.path, plan.destination, cwd);
    }
  } catch (materializationError) {
    const rollbackErrors = restoreMaterializationPlans(cwd, attemptedPlans);
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [materializationError, ...rollbackErrors],
        'Architecture materialization failed and one or more worktree documents could not be restored.',
        { cause: materializationError },
      );
    }
    throw materializationError;
  }

  return plans.map(({ result, destination, restoreWorktreeContent }) => ({
    action: result.action,
    path: destination,
    restoreWorktreeContent,
  }));
}

function planIndexMaterializations(
  cwd: string,
  snapshotDirectory: string,
  policy: IndexMaterializationPolicy,
): IndexMaterializationPlan[] {
  return selfHealProjectPreservingProse(snapshotDirectory, cwd, {
    renderUnchanged: policy.renderUnchanged,
    preservePriorStructure: policy.preservePriorStructure,
  }).map(result => {
    const relativePath = nodePath.relative(snapshotDirectory, result.path);
    if (
      relativePath === '' ||
      nodePath.isAbsolute(relativePath) ||
      relativePath === '..' ||
      relativePath.startsWith(`..${nodePath.sep}`)
    ) {
      throw new Error('Generated architecture path escaped the git index snapshot.');
    }

    return {
      result,
      destination: nodePath.join(cwd, relativePath),
      shouldWrite:
        isWouldChangeAction(result.action) ||
        (policy.writeUnchanged && result.action === 'unchanged'),
    };
  });
}

/**
 * Validate and snapshot every destination before replacing the first one. A
 * later unsafe or unreadable leaf must not leave an earlier root half-applied.
 */
function preflightIndexMaterializations(
  cwd: string,
  plans: IndexMaterializationPlan[],
  policy: IndexMaterializationPolicy,
): void {
  for (const plan of plans) {
    if (!plan.shouldWrite) continue;
    assertPhysicalContainment(cwd, plan.destination);
    plan.priorWorktreeState = readWorktreeDocumentState(plan.destination);
    plan.restoreWorktreeContent =
      policy.captureDivergentContent && isWouldChangeAction(plan.result.action)
        ? readDivergentWorktreeContent(cwd, plan.destination)
        : undefined;
  }
}

function indexMaterializationPolicy(mode: IndexMaterializationMode): IndexMaterializationPolicy {
  switch (mode) {
    case 'mutations-only': {
      return {
        renderUnchanged: false,
        preservePriorStructure: false,
        writeUnchanged: false,
        captureDivergentContent: true,
      };
    }
    case 'restore-staged-tree': {
      return {
        renderUnchanged: true,
        preservePriorStructure: true,
        writeUnchanged: true,
        captureDivergentContent: false,
      };
    }
  }
}

function readWorktreeDocumentState(destination: string): WorktreeDocumentState {
  try {
    return { existed: true, content: readFileSync(destination, 'utf8') };
  } catch (error_) {
    if ((error_ as NodeJS.ErrnoException).code === 'ENOENT') return { existed: false };
    throw error_;
  }
}

function restoreMaterializationPlans(cwd: string, plans: IndexMaterializationPlan[]): unknown[] {
  const errors: unknown[] = [];
  for (const plan of plans.toReversed()) {
    try {
      const priorState = plan.priorWorktreeState;
      if (priorState === undefined) continue;
      if (priorState.existed) {
        replaceArchitectureDocumentContent(priorState.content, plan.destination, cwd);
      } else {
        assertPhysicalContainment(cwd, plan.destination);
        rmSync(plan.destination, { force: true });
      }
    } catch (error_) {
      errors.push(error_);
    }
  }
  return errors;
}

/**
 * Return worktree document bytes only when they differ from the index copy.
 * `--stage` temporarily replaces that path to stage deterministic content, then
 * restores these bytes so unrelated worktree-only modules and prose survive.
 */
function readDivergentWorktreeContent(cwd: string, destination: string): string | undefined {
  assertPhysicalContainment(cwd, destination);
  let worktreeContent: string;
  try {
    worktreeContent = readFileSync(destination, 'utf8');
  } catch {
    return undefined;
  }

  const relativePath = nodePath.relative(cwd, destination);
  let indexContent: string | undefined;
  try {
    const projectRelativePath = relativePath.replaceAll('\\', '/');
    indexContent = execFileSync('git', ['show', `:./${projectRelativePath}`], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // An untracked worktree document has no index copy and must be preserved.
  }
  return worktreeContent === indexContent ? undefined : worktreeContent;
}

/** `git add` the regenerated doc; best-effort — a git failure never blocks the commit. */
function stageDocument(cwd: string, result: SelfHealResult): string | undefined {
  try {
    const relativePath = nodePath.relative(cwd, result.path);
    execFileSync('git', ['add', '--', relativePath], { cwd, stdio: 'ignore' });
    return undefined;
  } catch (error_) {
    return errorMessage(error_);
  }
}

const ARCHITECTURE_INPUT_BASENAMES = new Set([
  '.dependency-cruiser.cjs',
  '.dependency-cruiser.js',
  '.dependency-cruiser.json',
  '.dependency-cruiser.mjs',
  'Cargo.toml',
  'go.mod',
  'go.work',
  'package.json',
  'pnpm-workspace.yaml',
  'pyproject.toml',
]);

const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.py',
  '.rs',
  '.ts',
  '.tsx',
]);

function isPotentialArchitectureInput(path: string): boolean {
  const normalized = path.replaceAll('\\', '/');
  const segments = normalized.split('/');
  const basename = segments.at(-1) ?? '';
  return (
    segments.includes('src') ||
    segments.includes('lib') ||
    ARCHITECTURE_INPUT_BASENAMES.has(basename) ||
    normalized.endsWith('.prisma') ||
    normalized.endsWith('.sql') ||
    SOURCE_EXTENSIONS.has(nodePath.posix.extname(basename))
  );
}

function nulSeparatedGitPaths(cwd: string, args: string[]): string[] {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\0')
      .filter(path => path.length > 0);
  } catch {
    return [];
  }
}

/** Explain why staged-tree generation can intentionally disagree with `--check`. */
function warnExcludedWorktreeInputs(cwd: string): void {
  const excluded = new Set([
    ...nulSeparatedGitPaths(cwd, ['diff', '--name-only', '-z', '--']),
    ...nulSeparatedGitPaths(cwd, ['ls-files', '--others', '--exclude-standard', '-z', '--']),
  ]);
  const relevant = [...excluded]
    .filter(path => isPotentialArchitectureInput(path))
    .toSorted((a, b) => a.localeCompare(b));
  if (relevant.length === 0) return;

  const shown = relevant.slice(0, 20);
  const remainder = relevant.length - shown.length;
  const remainderSummary = remainder > 0 ? ` (+${remainder} more)` : '';
  warn(
    `Excluded unstaged/untracked architecture inputs from staged-tree generation: ${shown.join(', ')}${remainderSummary}`,
  );
}

function errorMessage(error_: unknown): string {
  return error_ instanceof Error ? error_.message.replaceAll(/\s+/g, ' ').trim() : String(error_);
}

/**
 * CI staleness backstop. Exits non-zero when ANY node is stale (would change),
 * passes when every node is current/`noop`/foreign or when enforcement is opted
 * out. Writes nothing — the fix is the human running `safeword architecture`.
 */
function architectureCheck(cwd: string): Promise<void> {
  warnUnreadableWorkspaces(cwd);
  warnNarrativeDrift(cwd);
  if (!isArchitectureDocumentEnforcementEnabled(cwd)) {
    success('Architecture doc enforcement is opted out (architectureDocEnforcement: false).');
    return Promise.resolve();
  }

  const stale = planSelfHealProject(cwd).filter(action => isWouldChangeAction(action));
  if (stale.length > 0) {
    error(
      `Architecture docs are stale (${stale.join(', ')}). Run \`safeword architecture\` to regenerate, then commit the result.`,
    );
    process.exit(1);
  }

  success('Architecture docs are current.');
  return Promise.resolve();
}
