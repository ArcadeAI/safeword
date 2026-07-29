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
  realpathSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import {
  isWouldChangeAction,
  planSelfHealProject,
  selfHealProject,
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

  const results = selfHealProject(cwd);
  for (const result of results) {
    success(`Architecture state document ${result.action}: ${result.path}`);
  }
  warnUnreadableWorkspaces(cwd);
  warnNarrativeDrift(cwd);
  return Promise.resolve();
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
    withGitIndexSnapshot(cwd, snapshotDirectory => {
      warnUnreadableWorkspaces(snapshotDirectory);
      if (!isArchitectureDocumentEnforcementEnabled(snapshotDirectory)) {
        success('Architecture doc enforcement is opted out (architectureDocEnforcement: false).');
        // Coverage honesty is not enforcement (see warnNarrativeDrift): surface
        // drift even when opted out, matching --check and default mode. Read the
        // index snapshot so an unstaged config or narrative cannot affect the commit.
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
          stageDocument(cwd, result);
          success(`Architecture doc ${result.action} and staged: ${result.path}`);
        }
      }
      // The snapshot contains the freshly healed document and the exact source
      // tree for this commit, so the advisory has the same provenance.
      warnNarrativeDrift(snapshotDirectory);
    });
  } catch {
    warn(
      'Could not complete staged-tree architecture generation; nothing was auto-staged. CI will verify freshness.',
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
    withGitIndexSnapshot(cwd, snapshotDirectory => {
      warnUnreadableWorkspaces(snapshotDirectory);
      const results = materializeIndexResults(cwd, snapshotDirectory, 'restore-staged-tree');
      for (const result of results) {
        success(`Architecture state document ${result.action}: ${result.path}`);
      }
      warnNarrativeDrift(snapshotDirectory);
    });
  } catch {
    error(
      'Could not complete staged-tree architecture generation; inspect the worktree before retrying.',
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
function withGitIndexSnapshot<T>(cwd: string, useSnapshot: (directory: string) => T): T {
  const snapshotDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-architecture-index-'));
  try {
    execFileSync(
      'git',
      [
        'checkout-index',
        '--all',
        '--force',
        '--ignore-skip-worktree-bits',
        `--prefix=${snapshotDirectory}${nodePath.sep}`,
      ],
      { cwd, stdio: 'ignore' },
    );
    prepareSnapshotProjectRoot(cwd, snapshotDirectory);
    return useSnapshot(snapshotDirectory);
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
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
function replaceArchitectureDocument(
  source: string,
  destination: string,
  allowedRoot: string,
): void {
  const destinationDirectory = nodePath.dirname(destination);
  mkdirSync(destinationDirectory, { recursive: true });
  assertPhysicalContainment(allowedRoot, destination);

  const temporaryDirectory = mkdtempSync(
    nodePath.join(destinationDirectory, '.safeword-architecture-'),
  );
  try {
    const temporaryPath = nodePath.join(temporaryDirectory, nodePath.basename(destination));
    copyFileSync(source, temporaryPath);
    renameSync(temporaryPath, destination);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

type IndexMaterializationMode = 'mutations-only' | 'restore-staged-tree';

/**
 * Heal inside the index snapshot, then copy only generated mutations to their
 * matching worktree paths. Returned paths always name the real worktree files.
 */
function materializeIndexResults(
  cwd: string,
  snapshotDirectory: string,
  mode: IndexMaterializationMode,
): SelfHealResult[] {
  assertSnapshotHealTargetsContained(snapshotDirectory);
  return selfHealProject(snapshotDirectory).map(result => {
    const relativePath = nodePath.relative(snapshotDirectory, result.path);
    if (
      relativePath === '' ||
      nodePath.isAbsolute(relativePath) ||
      relativePath === '..' ||
      relativePath.startsWith(`..${nodePath.sep}`)
    ) {
      throw new Error('Generated architecture path escaped the git index snapshot.');
    }

    const destination = nodePath.join(cwd, relativePath);
    if (
      isWouldChangeAction(result.action) ||
      (mode === 'restore-staged-tree' && result.action === 'unchanged')
    ) {
      assertPhysicalContainment(cwd, destination);
      replaceArchitectureDocument(result.path, destination, cwd);
    }
    return { action: result.action, path: destination };
  });
}

/** `git add` the regenerated doc; best-effort — a git failure never blocks the commit. */
function stageDocument(cwd: string, result: SelfHealResult): void {
  try {
    const relativePath = nodePath.relative(cwd, result.path);
    execFileSync('git', ['add', '--', relativePath], { cwd, stdio: 'ignore' });
  } catch {
    // Outside a git repo, or git unavailable: nothing to stage, never block.
  }
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
