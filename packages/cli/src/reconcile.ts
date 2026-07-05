/**
 * Reconciliation Engine
 *
 * Computes and executes plans based on SAFEWORD_SCHEMA and project state.
 * This is the single source of truth for all file/dir/config operations.
 */

import nodePath from 'node:path';

import type {
  FileDefinition,
  JsonMergeDefinition,
  ManagedFileDefinition,
  ProjectContext,
  SafewordSchema,
  TextPatchDefinition,
} from './schema.js';
import {
  NAMESPACE_ROOT_LEGACY,
  readConfiguredPath,
  resolveNamespaceRoot,
} from './utils/configured-paths.js';
import {
  ensureDirectory,
  exists,
  getTemplatesDirectory,
  makeScriptsExecutable,
  readFile,
  readFileSafe,
  readJson,
  remove,
  removeIfEmpty,
  writeFile,
  writeJson,
} from './utils/fs.js';
import {
  hashManagedFileContent,
  MANAGED_FILE_MANIFEST_PATH,
  type ManifestReadResult,
  readManagedFileManifest,
  recordManagedFileProvenance,
} from './utils/managed-file-manifest.js';
import type { ProjectType } from './utils/project-detector.js';
import { getWorkspacePackageNames } from './utils/workspaces.js';

// ============================================================================
// Constants
// ============================================================================

const HUSKY_DIR = '.husky';

/**
 * Directories containing executable scripts that need chmod +x.
 * Used by both install and upgrade plans.
 */
const CHMOD_PATHS = ['.safeword/hooks', '.safeword/hooks/cursor', '.safeword/scripts'];

/**
 * Prettier-related packages that should be skipped for projects with existing formatter.
 */
const PRETTIER_PACKAGES = new Set([
  'prettier',
  'prettier-plugin-astro',
  'prettier-plugin-tailwindcss',
  'prettier-plugin-sh',
]);

// Conditional-package keys whose condition is the ABSENCE of existing tooling,
// rather than a truthy ProjectType field: "standard" = no existing formatter.
const INVERTED_PACKAGE_CONDITIONS: Record<string, (projectType: ProjectType) => boolean> = {
  standard: projectType => !projectType.existingFormatter,
};

/**
 * Get conditional packages based on project type.
 * Handles inverted keys (standard) and prettier filtering for existing formatters.
 */
function getConditionalPackages(
  conditionalPackages: Record<string, string[]>,
  projectType: ProjectType,
): string[] {
  const packages: string[] = [];

  for (const [key, dependencies] of Object.entries(conditionalPackages)) {
    const inverted = INVERTED_PACKAGE_CONDITIONS[key];
    if (inverted) {
      if (inverted(projectType)) packages.push(...dependencies);
      continue;
    }

    // Check if this condition is met
    const conditionMet = projectType[key as keyof ProjectType];
    if (conditionMet) {
      // For projects with existing formatter, skip prettier-related packages
      if (projectType.existingFormatter) {
        packages.push(...dependencies.filter(pkg => !PRETTIER_PACKAGES.has(pkg)));
      } else {
        packages.push(...dependencies);
      }
    }
  }

  return packages;
}

/** Check if path should be skipped in non-git repos (husky files) */
function shouldSkipForNonGit(path: string, isGitRepo: boolean): boolean {
  return path.startsWith(HUSKY_DIR) && !isGitRepo;
}

/** Plan mkdir actions for directories that don't exist */
function planMissingDirectories(
  directories: string[],
  cwd: string,
  isGitRepo: boolean,
): { actions: Action[]; created: string[] } {
  const actions: Action[] = [];
  const created: string[] = [];
  for (const dir of directories) {
    if (shouldSkipForNonGit(dir, isGitRepo)) continue;
    if (!exists(nodePath.join(cwd, dir))) {
      actions.push({ type: 'mkdir', path: dir });
      created.push(dir);
    }
  }
  return { actions, created };
}

/**
 * Plan text-patch actions for all eligible targets. The executor
 * (`executeTextPatch`) decides whether to prepend, heal a legacy `---#`
 * artifact, or no-op based on the file's current contents — so the planner
 * stays uniform across modes for unguarded patches.
 * Keeping the marker check in the executor (not here) ensures `safeword
 * upgrade` reaches the heal path on pre-fix installs, which is what commit
 * a304af8 promised.
 */
function asPatchList(entry: TextPatchDefinition | TextPatchDefinition[]): TextPatchDefinition[] {
  return Array.isArray(entry) ? entry : [entry];
}

function planTextPatches(
  patches: Record<string, TextPatchDefinition | TextPatchDefinition[]>,
  ctx: ProjectContext,
): Action[] {
  const actions: Action[] = [];
  for (const [filePath, entry] of Object.entries(patches)) {
    if (shouldSkipForNonGit(filePath, ctx.isGitRepo)) continue;
    // Apply in list order so later patches land beneath earlier ones.
    actions.push(...planTextPatchesForFile(filePath, entry, ctx));
  }
  return actions;
}

function planTextPatchesForFile(
  filePath: string,
  entry: TextPatchDefinition | TextPatchDefinition[],
  ctx: ProjectContext,
): Action[] {
  const actions: Action[] = [];
  for (const definition of asPatchList(entry)) {
    if (!passesTextPatchContentGuard(ctx.cwd, filePath, definition)) continue;
    actions.push({
      type: 'text-patch',
      path: filePath,
      definition: resolveTextPatch(definition, ctx),
    });
  }
  return actions;
}

function passesTextPatchContentGuard(
  cwd: string,
  filePath: string,
  definition: TextPatchDefinition,
): boolean {
  if (!definition.applyWhenContentIncludes) return true;

  const content = readFileSafe(nodePath.join(cwd, filePath));
  return (
    content !== undefined &&
    definition.applyWhenContentIncludes.every(required => content.includes(required))
  );
}

function planTextUnpatches(
  patches: Record<string, TextPatchDefinition | TextPatchDefinition[]>,
  ctx: ProjectContext,
): Action[] {
  const hasLegacyPreamble = (content: string, definition: TextPatchDefinition): boolean => {
    const firstLine = content.split('\n', 1)[0] ?? '';
    return containsTextPatchContent(content, definition) || firstLine.includes(definition.marker);
  };

  const actions: Action[] = [];
  for (const [filePath, entry] of Object.entries(patches)) {
    if (shouldSkipForNonGit(filePath, ctx.isGitRepo)) continue;

    const fullPath = nodePath.join(ctx.cwd, filePath);
    if (!exists(fullPath)) continue;

    const content = readFileSafe(fullPath) ?? '';
    // Unpatch in reverse list order so the patch that owns file removal
    // (removeFileIfContentEquals) runs last, after siblings strip their blocks.
    for (const definition of asPatchList(entry).toReversed()) {
      if (hasLegacyPreamble(content, definition)) {
        actions.push({
          type: 'text-unpatch',
          path: filePath,
          definition: resolveTextPatch(definition, ctx),
        });
      }
    }
  }
  return actions;
}

function stripLeadingSafewordSeparator(value: string): string {
  if (value.startsWith('\n---')) {
    return value.slice('\n---'.length).replace(/^\n+/, '');
  }
  if (value.startsWith('---')) {
    return value.slice('---'.length).replace(/^\n+/, '');
  }
  return value;
}

/**
 * Generic file write planner with configurable skip condition.
 */
function planFileWrites(
  files: Record<string, FileDefinition>,
  ctx: ProjectContext,
  shouldSkip: (filePath: string, ctx: ProjectContext) => boolean,
): { actions: Action[]; created: string[] } {
  const actions: Action[] = [];
  const created: string[] = [];
  for (const [filePath, definition] of Object.entries(files)) {
    if (shouldSkip(filePath, ctx)) continue;
    const content = resolveFileContent(definition, ctx);
    // Skip files where generator returned undefined (e.g., non-JS projects)
    if (content === undefined) continue;
    actions.push({ type: 'write', path: filePath, content });
    created.push(filePath);
  }
  return { actions, created };
}

/** Owned files: skip husky files in non-git repos */
function planOwnedFileWrites(
  files: Record<string, FileDefinition>,
  ctx: ProjectContext,
): { actions: Action[]; created: string[] } {
  return planFileWrites(files, ctx, (filePath, c) => shouldSkipForNonGit(filePath, c.isGitRepo));
}

/**
 * Managed files: skip if file already exists OR if the entry has a
 * `configKey` whose `paths.<configKey>` override is set in
 * `.safeword/config.json` — see ticket K7N2QM.
 */
function planManagedFileWrites(
  files: Record<string, ManagedFileDefinition>,
  ctx: ProjectContext,
): { actions: Action[]; created: string[] } {
  return planFileWrites(files, ctx, (filePath, c) => {
    const definition = files[filePath];
    if (definition && isConfigOverridden(definition, c.cwd)) return true;
    return exists(nodePath.join(c.cwd, filePath));
  });
}

/** Plan rmdir actions for directories that exist */
function planExistingDirectoriesRemoval(
  directories: string[],
  cwd: string,
): { actions: Action[]; removed: string[] } {
  const actions: Action[] = [];
  const removed: string[] = [];
  for (const dir of directories) {
    if (!exists(nodePath.join(cwd, dir))) {
      continue;
    }

    actions.push({ type: 'rmdir', path: dir });
    removed.push(dir);
  }
  return { actions, removed };
}

/** Plan rm actions for files that exist */
function planExistingFilesRemoval(
  files: string[],
  cwd: string,
): { actions: Action[]; removed: string[] } {
  const actions: Action[] = [];
  const removed: string[] = [];
  for (const filePath of files) {
    if (!exists(nodePath.join(cwd, filePath))) {
      continue;
    }

    actions.push({ type: 'rm', path: filePath });
    removed.push(filePath);
  }
  return { actions, removed };
}

/** Check if a .claude path needs parent dir cleanup */
function getClaudeParentDirectoryForCleanup(filePath: string): string | undefined {
  if (!filePath.startsWith('.claude/')) return undefined;
  const parentDirectory = filePath.slice(0, Math.max(0, filePath.lastIndexOf('/')));
  if (
    !parentDirectory ||
    parentDirectory === '.claude' ||
    parentDirectory === '.claude/skills' ||
    parentDirectory === '.claude/commands'
  ) {
    return undefined;
  }
  return parentDirectory;
}

// ============================================================================
// Types
// ============================================================================

type ReconcileMode = 'install' | 'upgrade' | 'uninstall' | 'uninstall-full';

export type Action =
  | { type: 'mkdir'; path: string }
  | { type: 'rmdir'; path: string }
  | { type: 'write'; path: string; content: string }
  | { type: 'rm'; path: string }
  | { type: 'chmod'; paths: string[] }
  | { type: 'json-merge'; path: string; definition: JsonMergeDefinition }
  | { type: 'json-unmerge'; path: string; definition: JsonMergeDefinition }
  | { type: 'text-patch'; path: string; definition: ResolvedTextPatch }
  | { type: 'text-unpatch'; path: string; definition: ResolvedTextPatch }
  // Provenance recording for managed files (ticket A4HG61, #849). Built at
  // plan time (hashes of the content the plan writes), executed only in
  // executePlan — so dry runs (diff) preview refreshes without recording.
  | { type: 'manifest-record'; entries: Record<string, string> };

// A TextPatchDefinition whose ctx-factory `content` has been resolved to a string
// at plan time, so executors never see a function (#293).
type ResolvedTextPatch = Omit<TextPatchDefinition, 'content'> & { content: string };

function resolveTextPatch(definition: TextPatchDefinition, ctx: ProjectContext): ResolvedTextPatch {
  return {
    ...definition,
    content:
      typeof definition.content === 'function' ? definition.content(ctx) : definition.content,
  };
}

export interface ReconcileResult {
  actions: Action[];
  applied: boolean;
  created: string[];
  updated: string[];
  removed: string[];
  packagesToInstall: string[];
  packagesToRemove: string[];
  // Non-fatal issues surfaced during execution (e.g. a jsonMerge target that
  // exists but doesn't parse, so the merge was skipped rather than silently lost).
  // Empty on a dry run, which never executes merges.
  warnings: string[];
}

interface ReconcileOptions {
  dryRun?: boolean;
}

// ============================================================================
// Main reconcile function
// ============================================================================

/**
 * Realize the schema's namespace paths at the resolved root (ticket N9S5XG).
 *
 * The schema manifest stays static with legacy-prefixed namespace entries
 * (`.safeword-project/...`); at planning time those entries are mapped onto
 * the resolved root — `.project/` for fresh repos, an adopted existing
 * `.project/`, a configured `paths.projectRoot`, or the legacy root itself
 * (identity translation) where only it exists. One seam covers install,
 * upgrade, diff (dry-run upgrade), and uninstall alike.
 */
function withResolvedNamespaceRoot(schema: SafewordSchema, ctx: ProjectContext): SafewordSchema {
  const root = ctx.namespaceRoot ?? resolveNamespaceRoot(ctx.cwd);
  // Empty relative label means the namespace root IS the repo root
  // (paths.projectRoot: '.') — translate to bare subpaths, not legacy.
  const label = nodePath.relative(ctx.cwd, root) || '.';
  if (label === NAMESPACE_ROOT_LEGACY) return schema;

  const translate = (path: string): string => {
    if (path !== NAMESPACE_ROOT_LEGACY && !path.startsWith(`${NAMESPACE_ROOT_LEGACY}/`)) {
      return path;
    }
    const subpath = path.slice(NAMESPACE_ROOT_LEGACY.length).replace(/^\//, '');
    return label === '.' ? subpath || '.' : nodePath.join(label, subpath);
  };

  return {
    ...schema,
    preservedDirs: schema.preservedDirs.map(path => translate(path)),
    managedFiles: Object.fromEntries(
      Object.entries(schema.managedFiles)
        .map(([path, definition]) => [translate(path), definition] as const)
        // A per-root `.gitignore` (issue #272) translated onto the repo root
        // (paths.projectRoot: '.') would BE the user's own root `.gitignore` —
        // owned by the textPatch, never created by us (create-if-missing skips
        // an existing file). Drop it there so a full uninstall can't delete a
        // file we didn't write.
        .filter(([translatedPath]) => translatedPath !== '.gitignore'),
    ),
  };
}

export async function reconcile(
  schema: SafewordSchema,
  mode: ReconcileMode,
  ctx: ProjectContext,
  options?: ReconcileOptions,
): Promise<ReconcileResult> {
  // Public API contract is Promise<ReconcileResult>; some plan executors are
  // sync today, but the signature reserves room for async I/O without
  // breaking callers. Token await keeps the contract honest.
  await Promise.resolve();
  const isDryRun = options?.dryRun ?? false;

  const plan = computePlan(withResolvedNamespaceRoot(schema, ctx), mode, ctx);

  if (isDryRun) {
    return {
      actions: plan.actions,
      applied: false,
      created: plan.wouldCreate,
      updated: plan.wouldUpdate,
      removed: plan.wouldRemove,
      packagesToInstall: plan.packagesToInstall,
      packagesToRemove: plan.packagesToRemove,
      warnings: plan.warnings ?? [],
    };
  }

  const result = executePlan(plan, ctx);

  return {
    actions: plan.actions,
    applied: true,
    created: result.created,
    updated: result.updated,
    removed: result.removed,
    packagesToInstall: plan.packagesToInstall,
    packagesToRemove: plan.packagesToRemove,
    warnings: [...(plan.warnings ?? []), ...result.warnings],
  };
}

// ============================================================================
// Plan computation
// ============================================================================

interface ReconcilePlan {
  actions: Action[];
  wouldCreate: string[];
  wouldUpdate: string[];
  wouldRemove: string[];
  packagesToInstall: string[];
  packagesToRemove: string[];
  /** Plan-time warnings (e.g. corrupt provenance manifest, A4HG61). */
  warnings?: string[];
}

function computePlan(
  schema: SafewordSchema,
  mode: ReconcileMode,
  ctx: ProjectContext,
): ReconcilePlan {
  switch (mode) {
    case 'install': {
      return computeInstallPlan(schema, ctx);
    }
    case 'upgrade': {
      return computeUpgradePlan(schema, ctx);
    }
    case 'uninstall': {
      return computeUninstallPlan(schema, ctx, false);
    }
    case 'uninstall-full': {
      return computeUninstallPlan(schema, ctx, true);
    }
    default: {
      // Exhaustive check - TypeScript ensures all cases are handled
      const _exhaustiveCheck: never = mode;
      return _exhaustiveCheck;
    }
  }
}

function computeInstallPlan(schema: SafewordSchema, ctx: ProjectContext): ReconcilePlan {
  const actions: Action[] = [];
  const wouldCreate: string[] = [];

  // 1. Create all directories
  const allDirectories = [...schema.ownedDirs, ...schema.sharedDirs, ...schema.preservedDirs];
  const directories = planMissingDirectories(allDirectories, ctx.cwd, ctx.isGitRepo);
  actions.push(...directories.actions);
  wouldCreate.push(...directories.created);

  // 2. Write owned files
  const owned = planOwnedFileWrites(schema.ownedFiles, ctx);
  actions.push(...owned.actions);
  wouldCreate.push(...owned.created);

  // 3. Write managed files (only if missing)
  const managed = planManagedFileWrites(schema.managedFiles, ctx);
  actions.push(...managed.actions);
  wouldCreate.push(...managed.created);

  // 3b. Record provenance for the managed files this plan writes (A4HG61,
  // #849): hash the planned content now, merge into the manifest at execute
  // time. Merge semantics preserve committed provenance on clones. Paths a
  // json-merge co-owns are excluded — the merge rewrites them post-write, so
  // their pre-merge hash would be permanently stale (see the upgrade pass).
  const mergeOwnedPaths = new Set(Object.keys(schema.jsonMerges));
  actions.push({
    type: 'manifest-record',
    entries: manifestEntriesFromWrites(managed.actions, mergeOwnedPaths),
  });

  // 4. chmod hook/lib/scripts directories
  const chmodPaths = [...CHMOD_PATHS];
  if (ctx.isGitRepo) chmodPaths.push(HUSKY_DIR);
  actions.push({ type: 'chmod', paths: chmodPaths });

  // 5. JSON merges
  for (const [filePath, definition] of Object.entries(schema.jsonMerges)) {
    actions.push({ type: 'json-merge', path: filePath, definition });
  }

  // 6. Text patches — unguarded patches create absent target files; guarded
  // patches only run when the current file proves it is safe to touch.
  actions.push(...planTextUnpatches(schema.legacyTextPatches, ctx));
  const textPatchActions = planTextPatches(schema.textPatches, ctx);
  actions.push(...textPatchActions);
  for (const action of textPatchActions) {
    if (action.type === 'text-patch' && !exists(nodePath.join(ctx.cwd, action.path))) {
      wouldCreate.push(action.path);
    }
  }

  // 7. Compute packages to install
  const packagesToInstall = computePackagesToInstall(
    schema,
    ctx.projectType,
    ctx.developmentDeps,
    ctx.cwd,
  );

  return {
    actions,
    wouldCreate,
    wouldUpdate: [],
    wouldRemove: [],
    packagesToInstall,
    packagesToRemove: [],
  };
}

interface FileActionResult {
  actions: Action[];
  created: string[];
  updated: string[];
}

/** Provenance entries (path → sha256) for the write actions in a plan slice (A4HG61). */
function manifestEntriesFromWrites(
  actions: Action[],
  excludePaths: ReadonlySet<string>,
): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const action of actions) {
    if (action.type === 'write' && !excludePaths.has(action.path)) {
      entries[action.path] = hashManagedFileContent(action.content);
    }
  }
  return entries;
}

/**
 * Plan actions for owned files (always update if content changed).
 */
function planOwnedFilesActions(
  ownedFiles: Record<string, FileDefinition>,
  ctx: ProjectContext,
): FileActionResult {
  const actions: Action[] = [];
  const created: string[] = [];
  const updated: string[] = [];

  for (const [filePath, definition] of Object.entries(ownedFiles)) {
    if (shouldSkipForNonGit(filePath, ctx.isGitRepo)) continue;

    const fullPath = nodePath.join(ctx.cwd, filePath);
    const newContent = resolveFileContent(definition, ctx);

    if (newContent === undefined) continue;
    if (!fileNeedsUpdate(fullPath, newContent)) continue;

    actions.push({ type: 'write', path: filePath, content: newContent });
    if (exists(fullPath)) {
      updated.push(filePath);
    } else {
      created.push(filePath);
    }
  }

  return { actions, created, updated };
}

/**
 * True when the managed-file entry has a `configKey` AND a corresponding
 * `paths.<configKey>` override is set in `.safeword/config.json`. Used to
 * suppress install scaffolding and uninstall-full removal uniformly when
 * the user has redirected the read target (ticket K7N2QM).
 */
function isConfigOverridden(definition: ManagedFileDefinition, cwd: string): boolean {
  if (!definition.configKey) return false;
  return readConfiguredPath(cwd, definition.configKey) !== undefined;
}

interface ManagedFilePlanResult extends FileActionResult {
  warnings: string[];
}

/**
 * Plan actions for managed files on upgrade: create if missing, refresh if
 * provably pristine (ticket A4HG61, #849).
 *
 * A file is refreshed only when its on-disk bytes hash to exactly what the
 * provenance manifest says safeword last wrote AND the currently resolved
 * content differs — customer edits are never touched. A file whose bytes
 * already equal the resolved output has its record healed/adopted (recorded
 * without a write; spec DD9). A corrupt manifest fails safe and loud: no
 * refresh, no recording, one warning (spec DD8).
 *
 * Entries with a `configKey` whose `paths.<configKey>` override is set in
 * `.safeword/config.json` are suppressed — the user has redirected
 * safeword to read from elsewhere, so the default location is no longer
 * safeword's concern (ticket K7N2QM).
 */
function planManagedFilesActions(
  managedFiles: Record<string, ManagedFileDefinition>,
  ctx: ProjectContext,
  mergeOwnedPaths: ReadonlySet<string>,
): ManagedFilePlanResult {
  const actions: Action[] = [];
  const created: string[] = [];
  const updated: string[] = [];
  const provenance: Record<string, string> = {};

  const manifest = readManagedFileManifest(ctx.cwd);
  const warnings = corruptManifestWarnings(manifest);

  for (const [filePath, definition] of Object.entries(managedFiles)) {
    if (isConfigOverridden(definition, ctx.cwd)) continue;
    const newContent = resolveFileContent(definition, ctx);
    if (newContent === undefined) continue;

    const decision = mergeOwnedPaths.has(filePath)
      ? decideMergeOwnedAction(filePath, ctx.cwd)
      : decideManagedFileAction(filePath, newContent, ctx.cwd, manifest);
    if (decision.kind === 'skip') continue;
    if (decision.hash !== undefined) provenance[filePath] = decision.hash;
    if (decision.kind === 'record') continue;

    actions.push({ type: 'write', path: filePath, content: newContent });
    (decision.kind === 'create' ? created : updated).push(filePath);
  }

  actions.push({ type: 'manifest-record', entries: provenance });
  return { actions, created, updated, warnings };
}

export type ManagedFileDecision =
  | { kind: 'skip'; hash?: undefined }
  | { kind: 'create'; hash: string | undefined }
  | { kind: 'record'; hash: string }
  | { kind: 'refresh'; hash: string };

/** One warning when the provenance manifest is unreadable (spec DD8) — else none. */
function corruptManifestWarnings(manifest: ManifestReadResult): string[] {
  if (manifest.kind !== 'corrupt') return [];
  return [
    `${MANAGED_FILE_MANIFEST_PATH} is unreadable — managed configs will not be refreshed until it is fixed or deleted.`,
  ];
}

/**
 * A managed file that a json-merge also edits (e.g. .prettierrc plugin
 * injection) is rewritten AFTER the managed write, so a recorded hash of the
 * pre-merge bytes would be permanently stale — and re-hashing after the merge
 * would make refresh strip what the merge re-adds, forever. Merge-co-owned
 * paths keep create-if-missing and stay untracked.
 */
function decideMergeOwnedAction(filePath: string, cwd: string): ManagedFileDecision {
  return exists(nodePath.join(cwd, filePath))
    ? { kind: 'skip' }
    : { kind: 'create', hash: undefined };
}

/**
 * The per-file provenance decision (spec's 7-case rule). `record` means
 * heal/adopt: no write, just record — byte-identity to resolved output
 * proves the content is safeword's (DD9). Exported for the unit-level
 * matrix proof (tests/reconcile-managed-refresh.test.ts).
 */
export function decideManagedFileAction(
  filePath: string,
  newContent: string,
  cwd: string,
  manifest: ManifestReadResult,
): ManagedFileDecision {
  const fullPath = nodePath.join(cwd, filePath);
  if (!exists(fullPath)) {
    // Corrupt manifest: still create-if-missing, but record nothing (DD8).
    return {
      kind: 'create',
      hash: manifest.kind === 'corrupt' ? undefined : hashManagedFileContent(newContent),
    };
  }
  // Existing file + corrupt manifest: pristineness unprovable — fail safe.
  if (manifest.kind === 'corrupt') return { kind: 'skip' };

  const onDiskHash = hashManagedFileContent(readFile(fullPath));
  const newHash = hashManagedFileContent(newContent);
  const recordedHash = manifest.kind === 'ok' ? manifest.files[filePath] : undefined;

  if (onDiskHash === newHash) {
    return recordedHash === newHash ? { kind: 'skip' } : { kind: 'record', hash: newHash };
  }
  if (recordedHash === onDiskHash) return { kind: 'refresh', hash: newHash };
  // Edited, or unrecorded-and-differing — never touched.
  return { kind: 'skip' };
}

function computeUpgradePlan(schema: SafewordSchema, ctx: ProjectContext): ReconcilePlan {
  const actions: Action[] = [];
  const wouldCreate: string[] = [];
  const wouldUpdate: string[] = [];

  // 1. Ensure directories exist (skip .husky if not a git repo)
  const allDirectories = [...schema.ownedDirs, ...schema.sharedDirs, ...schema.preservedDirs];
  const missingDirectories = planMissingDirectories(allDirectories, ctx.cwd, ctx.isGitRepo);
  actions.push(...missingDirectories.actions);
  wouldCreate.push(...missingDirectories.created);

  // 2. Update owned files if content changed
  const ownedFilesResult = planOwnedFilesActions(schema.ownedFiles, ctx);
  actions.push(...ownedFilesResult.actions);
  wouldCreate.push(...ownedFilesResult.created);
  wouldUpdate.push(...ownedFilesResult.updated);

  // 3. Managed files: create if missing, refresh if provably pristine (A4HG61)
  const managedFilesResult = planManagedFilesActions(
    schema.managedFiles,
    ctx,
    new Set(Object.keys(schema.jsonMerges)),
  );
  actions.push(...managedFilesResult.actions);
  wouldCreate.push(...managedFilesResult.created);
  wouldUpdate.push(...managedFilesResult.updated);

  // 4. Remove deprecated files (renamed or removed in newer versions)
  const deprecatedFiles = planExistingFilesRemoval(schema.deprecatedFiles, ctx.cwd);
  actions.push(...deprecatedFiles.actions);
  const wouldRemove = deprecatedFiles.removed;

  // 4b. Remove deprecated directories (no longer managed by safeword)
  const deprecatedDirectories = planExistingDirectoriesRemoval(schema.deprecatedDirs, ctx.cwd);
  actions.push(...deprecatedDirectories.actions);
  wouldRemove.push(...deprecatedDirectories.removed);

  // 5. chmod
  actions.push({ type: 'chmod', paths: CHMOD_PATHS });

  // 6. JSON merges (always apply to ensure keys are present)
  for (const [filePath, definition] of Object.entries(schema.jsonMerges)) {
    actions.push({ type: 'json-merge', path: filePath, definition });
  }

  // 7. Text patches
  actions.push(
    ...planTextUnpatches(schema.legacyTextPatches, ctx),
    ...planTextPatches(schema.textPatches, ctx),
  );

  // 8. Compute packages to install
  const packagesToInstall = computePackagesToInstall(
    schema,
    ctx.projectType,
    ctx.developmentDeps,
    ctx.cwd,
  );

  // 9. Compute deprecated packages to remove (only those actually installed)
  const packagesToRemove = schema.deprecatedPackages.filter(pkg =>
    Object.hasOwn(ctx.developmentDeps, pkg),
  );

  return {
    actions,
    wouldCreate,
    wouldUpdate,
    wouldRemove,
    packagesToInstall,
    packagesToRemove,
    warnings: managedFilesResult.warnings,
  };
}

function computeUninstallPlan(
  schema: SafewordSchema,
  ctx: ProjectContext,
  full: boolean,
): ReconcilePlan {
  const actions: Action[] = [];
  const wouldRemove: string[] = [];

  // 1. Remove all owned files and track parent dirs for cleanup.
  // cucumber.mjs is only safeword's when the lane is safeword's to scaffold —
  // in a suppressed-lane repo the root cucumber.mjs is the HOST's own config
  // and must survive uninstall (ticket 56JCFZ, TB1.AC3).
  const removableOwnedPaths = Object.keys(schema.ownedFiles).filter(
    filePath => filePath !== 'cucumber.mjs' || ctx.projectType.scaffoldBddLane,
  );
  const ownedFiles = planExistingFilesRemoval(removableOwnedPaths, ctx.cwd);
  actions.push(...ownedFiles.actions);
  wouldRemove.push(...ownedFiles.removed);

  // Collect parent dirs that need cleanup (for .claude/* skill dirs)
  const directoriesToCleanup = new Set<string>();
  for (const filePath of ownedFiles.removed) {
    const parentDirectory = getClaudeParentDirectoryForCleanup(filePath);
    if (parentDirectory) directoriesToCleanup.add(parentDirectory);
  }
  const cleanupDirectories = planExistingDirectoriesRemoval([...directoriesToCleanup], ctx.cwd);
  actions.push(...cleanupDirectories.actions);
  wouldRemove.push(...cleanupDirectories.removed);

  // 1b. Remove the provenance manifest (A4HG61, #849) in BOTH modes — it is
  // safeword state, meaningless without safeword, and not a schema entry
  // (dynamic state, not a template), so it needs its own explicit removal:
  // directory cleanup is remove-if-empty and would silently leave it behind.
  const manifest = planExistingFilesRemoval([MANAGED_FILE_MANIFEST_PATH], ctx.cwd);
  actions.push(...manifest.actions);
  wouldRemove.push(...manifest.removed);

  // 2. JSON unmerges
  for (const [filePath, definition] of Object.entries(schema.jsonMerges)) {
    actions.push({ type: 'json-unmerge', path: filePath, definition });
  }

  // 3. Text unpatches
  actions.push(
    ...planTextUnpatches(schema.textPatches, ctx),
    ...planTextUnpatches(schema.legacyTextPatches, ctx),
  );

  // 4. Remove preserved directories first (reverse order, only if empty)
  const preserved = planExistingDirectoriesRemoval(schema.preservedDirs.toReversed(), ctx.cwd);
  actions.push(...preserved.actions);
  wouldRemove.push(...preserved.removed);

  // 5. Remove owned directories (reverse order ensures children before parents)
  const owned = planExistingDirectoriesRemoval(schema.ownedDirs.toReversed(), ctx.cwd);
  actions.push(...owned.actions);
  wouldRemove.push(...owned.removed);

  // 6. Full uninstall: remove managed files (skip configKey-overridden entries —
  //    when the user has set paths.<configKey>, the default location is no longer
  //    safeword's concern, and any file there is user content we must not delete.
  //    See ticket K7N2QM).
  if (full) {
    const removable = Object.entries(schema.managedFiles)
      .filter(([, definition]) => !isConfigOverridden(definition, ctx.cwd))
      .map(([filePath]) => filePath);
    const managed = planExistingFilesRemoval(removable, ctx.cwd);
    actions.push(...managed.actions);
    wouldRemove.push(...managed.removed);
  }

  // 7. Compute packages to remove (full only)
  const packagesToRemove = full
    ? computePackagesToRemove(schema, ctx.projectType, ctx.developmentDeps)
    : [];

  return {
    actions,
    wouldCreate: [],
    wouldUpdate: [],
    wouldRemove,
    packagesToInstall: [],
    packagesToRemove,
  };
}

// ============================================================================
// Plan execution
// ============================================================================

interface ExecutionResult {
  created: string[];
  updated: string[];
  removed: string[];
  warnings: string[];
}

function executePlan(plan: ReconcilePlan, ctx: ProjectContext): ExecutionResult {
  const created: string[] = [];
  const updated: string[] = [];
  const removed: string[] = [];
  const warnings: string[] = [];
  const result = { created, updated, removed, warnings };

  for (const action of plan.actions) {
    executeAction(action, ctx, result);
  }

  return result;
}

function executeChmod(cwd: string, paths: string[]): void {
  for (const path of paths) {
    const fullPath = nodePath.join(cwd, path);
    if (exists(fullPath)) makeScriptsExecutable(fullPath);
  }
}

function executeRmdir(cwd: string, path: string, result: ExecutionResult): void {
  if (removeIfEmpty(nodePath.join(cwd, path))) result.removed.push(path);
}

type ContentAction = Extract<
  Action,
  { type: 'json-merge' | 'json-unmerge' | 'text-patch' | 'text-unpatch' | 'manifest-record' }
>;

const CONTENT_ACTION_TYPES: ReadonlySet<Action['type']> = new Set([
  'json-merge',
  'json-unmerge',
  'text-patch',
  'text-unpatch',
  'manifest-record',
] satisfies ContentAction['type'][]);

function isContentAction(action: Action): action is ContentAction {
  return CONTENT_ACTION_TYPES.has(action.type);
}

function executeAction(action: Action, ctx: ProjectContext, result: ExecutionResult): void {
  if (isContentAction(action)) {
    executeContentAction(action, ctx, result);
    return;
  }
  switch (action.type) {
    case 'mkdir': {
      ensureDirectory(nodePath.join(ctx.cwd, action.path));
      result.created.push(action.path);
      break;
    }
    case 'rmdir': {
      executeRmdir(ctx.cwd, action.path, result);
      break;
    }
    case 'write': {
      executeWrite(ctx.cwd, action.path, action.content, result);
      break;
    }
    case 'rm': {
      remove(nodePath.join(ctx.cwd, action.path));
      result.removed.push(action.path);
      break;
    }
    case 'chmod': {
      executeChmod(ctx.cwd, action.paths);
      break;
    }
  }
}

/** JSON-merge, text-patch, and provenance actions — the non-filesystem-shape half of executeAction. */
function executeContentAction(
  action: ContentAction,
  ctx: ProjectContext,
  result: ExecutionResult,
): void {
  switch (action.type) {
    case 'json-merge': {
      executeJsonMerge(ctx.cwd, action.path, action.definition, ctx, result);
      break;
    }
    case 'json-unmerge': {
      executeJsonUnmerge(ctx.cwd, action.path, action.definition, ctx);
      break;
    }
    case 'text-patch': {
      executeTextPatch(ctx.cwd, action.path, action.definition);
      break;
    }
    case 'text-unpatch': {
      executeTextUnpatch(ctx.cwd, action.path, action.definition);
      break;
    }
    case 'manifest-record': {
      recordManagedFileProvenance(ctx.cwd, action.entries);
      break;
    }
  }
}

function executeWrite(cwd: string, path: string, content: string, result: ExecutionResult): void {
  const fullPath = nodePath.join(cwd, path);
  const isExisted = exists(fullPath);
  writeFile(fullPath, content);
  (isExisted ? result.updated : result.created).push(path);
}

// ============================================================================
// Helper functions
// ============================================================================

function resolveFileContent(definition: FileDefinition, ctx: ProjectContext): string | undefined {
  if (definition.generator) {
    // Generator decides (undefined = skip file). Takes precedence over
    // `template` so an entry can declare its template provenance (for the
    // schema↔templates contract) while gating on project context (56JCFZ).
    return definition.generator(ctx);
  }

  if (definition.template) {
    const templatesDirectory = getTemplatesDirectory();
    return readFile(nodePath.join(templatesDirectory, definition.template));
  }

  if (definition.content) {
    return typeof definition.content === 'function' ? definition.content() : definition.content;
  }

  throw new Error('FileDefinition must have template, content, or generator');
}

function fileNeedsUpdate(installedPath: string, newContent: string): boolean {
  if (!exists(installedPath)) return true;
  const currentContent = readFileSafe(installedPath);
  return currentContent?.trim() !== newContent.trim();
}

export function computePackagesToInstall(
  schema: SafewordSchema,
  projectType: ProjectType,
  installedDevelopmentDependencies: Record<string, string>,
  cwd?: string,
): string[] {
  // Combine base packages with conditional packages
  const needed = [
    ...schema.packages.base,
    ...getConditionalPackages(schema.packages.conditional, projectType),
  ];

  // Skip packages provided by workspace members (prevents circular self-install in monorepos)
  const workspaceMembers = cwd ? getWorkspacePackageNames(cwd) : new Set<string>();

  // Strip version specifier (e.g. 'eslint@^9' → 'eslint') when checking installed deps
  return needed.filter(pkg => {
    const name = stripVersionSpecifier(pkg);
    return !workspaceMembers.has(name) && !Object.hasOwn(installedDevelopmentDependencies, name);
  });
}

function computePackagesToRemove(
  schema: SafewordSchema,
  projectType: ProjectType,
  installedDevelopmentDependencies: Record<string, string>,
): string[] {
  const safewordPackages = [
    ...schema.packages.base,
    ...getConditionalPackages(schema.packages.conditional, projectType),
  ];

  // Only remove packages that are actually installed
  // Strip version specifier (e.g. 'eslint@^9' → 'eslint') when checking installed deps
  return safewordPackages.filter(pkg =>
    Object.hasOwn(installedDevelopmentDependencies, stripVersionSpecifier(pkg)),
  );
}

/**
 * Strip version specifier from a package name.
 * e.g. 'eslint@^9' → 'eslint', 'safeword' → 'safeword', '@next/eslint-plugin-next@^16' → '@next/eslint-plugin-next'
 */
function stripVersionSpecifier(pkg: string): string {
  // Scoped packages start with @ — find the version @ after the scope
  const atIndex = pkg.startsWith('@') ? pkg.indexOf('@', 1) : pkg.indexOf('@');
  return atIndex === -1 ? pkg : pkg.slice(0, atIndex);
}

function executeJsonMerge(
  cwd: string,
  path: string,
  definition: JsonMergeDefinition,
  ctx: ProjectContext,
  result: ExecutionResult,
): void {
  const fullPath = nodePath.join(cwd, path);
  const rawExisting = readJson(fullPath) as Record<string, unknown> | undefined;

  if (!rawExisting) {
    // A present-but-unparseable target (JSONC comments, a trailing comma, or genuine
    // malformation) reads as undefined just like an absent file. Skipping is correct —
    // overwriting would clobber the customer's config — but doing it silently hides the
    // merge that never landed (the #262 commented-`.markdownlint-cli2.jsonc` case, and the
    // same trap for any jsonMerge target). Distinguish the two: warn when the file exists,
    // stay silent when it's genuinely absent.
    if (exists(fullPath)) {
      result.warnings.push(
        `Skipped merging safeword config into ${path}: the file exists but could not be read as JSON ` +
          `(it may contain JSONC comments, which the merge engine does not support, or otherwise not be valid JSON). ` +
          `Add these keys manually if you need them: ${definition.keys.join(', ')}.`,
      );
      return;
    }
    // Genuinely absent: honor skipIfMissing; otherwise fall through and create it.
    if (definition.skipIfMissing) return;
  }

  const existing = rawExisting ?? {};
  const merged = definition.merge(existing, ctx);

  // Skip write if content is unchanged (avoids formatting churn)
  if (JSON.stringify(existing) === JSON.stringify(merged)) return;

  writeJson(fullPath, merged);
}

function executeJsonUnmerge(
  cwd: string,
  path: string,
  definition: JsonMergeDefinition,
  ctx: ProjectContext,
): void {
  const fullPath = nodePath.join(cwd, path);
  if (!exists(fullPath)) return;

  const existing = readJson(fullPath) as Record<string, unknown> | undefined;
  if (!existing) return;

  const unmerged = definition.unmerge(existing, ctx);

  // Check if file should be removed
  if (definition.removeFileIfEmpty) {
    const remainingKeys = Object.keys(unmerged).filter(k => unmerged[k] !== undefined);
    if (remainingKeys.length === 0) {
      remove(fullPath);
      return;
    }
  }

  writeJson(fullPath, unmerged);
}

/**
 * The safeword-owned body lines of a re-renderable block, in order, taken from
 * the freshly-resolved content (the header/marker line excluded).
 */
function rerenderBlockLines(definition: ResolvedTextPatch): string[] {
  return definition.content
    .split('\n')
    .filter(line => line !== '' && !line.includes(definition.marker));
}

/**
 * Remove a re-renderable managed block so a fresh, ctx-resolved version can be
 * re-appended (#293). Consumes the `marker` header plus the contiguous run of
 * disk lines that match the fresh block's body lines *in order* — an on-disk
 * block is always a prefix of the new one (the owned-dir set only grows and its
 * order is fixed), so a customer line that breaks the sequence (even one that
 * coincidentally equals an owned dir) is never consumed.
 */
function stripRerenderBlock(content: string, definition: ResolvedTextPatch): string {
  const lines = content.split('\n');
  const startIndex = lines.findIndex(line => line.includes(definition.marker));
  if (startIndex === -1) return content;

  const blockLines = rerenderBlockLines(definition);
  let endIndex = startIndex;
  let expected = 0;
  while (
    endIndex + 1 < lines.length &&
    expected < blockLines.length &&
    lines[endIndex + 1] === blockLines[expected]
  ) {
    endIndex += 1;
    expected += 1;
  }

  // Also drop a single blank separator line immediately before the header.
  const blockStart = startIndex > 0 && lines[startIndex - 1] === '' ? startIndex - 1 : startIndex;
  lines.splice(blockStart, endIndex - blockStart + 1);
  return lines.join('\n').replaceAll(/\n{3,}/g, '\n\n');
}

function executeTextPatch(cwd: string, path: string, definition: ResolvedTextPatch): void {
  // rerender re-appends the block at EOF, so it only makes sense for `append`.
  if (definition.rerender && definition.operation !== 'append') {
    throw new Error(`rerender text patch ${path} must use operation: 'append'`);
  }

  const fullPath = nodePath.join(cwd, path);
  const original = readFileSafe(fullPath) ?? '';

  // Supersede: byte-exact strip of the legacy block this patch replaces (a no-op
  // when absent), so a customized managed file migrates the old block to `content`
  // on upgrade. Runs before the marker check so the swap still applies when the
  // replacement block is being added for the first time.
  const content =
    definition.supersedes === undefined ? original : original.replace(definition.supersedes, '');

  // Already patched: re-render/heal in place, persisting any supersede strip.
  if (content.includes(definition.marker)) {
    healAlreadyPatchedFile(fullPath, original, content, definition);
    return;
  }

  // Apply patch (this write also persists any supersede strip above).
  const patched =
    definition.operation === 'prepend'
      ? definition.content + content
      : content + definition.content;
  writeFile(fullPath, patched);
}

// The marker is already present. Re-render a drifted managed block (#293), heal a
// legacy `---#` separator artifact from safeword <=0.30.1, and/or persist a
// supersede strip. `content` is post-supersede; `original` is the on-disk text.
function healAlreadyPatchedFile(
  fullPath: string,
  original: string,
  content: string,
  definition: ResolvedTextPatch,
): void {
  // Re-renderable block (#293): when the resolved content has drifted from what's
  // on disk (e.g. a custom paths.projectRoot was added), replace the managed block
  // in place so existing installs heal on upgrade. A no-op when already current.
  if (definition.rerender && !content.includes(definition.content)) {
    writeFile(fullPath, stripRerenderBlock(content, definition) + definition.content);
    return;
  }
  // Heal the bare-`---` separator that glued to a heading (`---# CLAUDE.md`) in
  // files corrupted by past installs. Narrowly scoped: the marker proves we
  // authored the block, and only the exact artifact is repaired.
  let healed = content;
  if (healed.includes('\n\n---#')) {
    healed = healed.replaceAll('\n\n---#', '\n\n---\n\n#');
  }
  // Persist if a heal and/or supersede strip changed the file (the latter is rare
  // here — a legacy block lingering alongside its replacement).
  if (healed !== original) writeFile(fullPath, healed);
}

function computeUnpatchedContent(content: string, definition: ResolvedTextPatch): string {
  let unpatched = removeExactTextPatchContent(content, definition);

  // Re-render patches (#293): the on-disk block can differ from the ctx-resolved
  // content (e.g. paths.projectRoot changed since install), so an exact removal
  // misses it. Fall back to the marker-anchored, sequence-bounded strip — which
  // never consumes a customer line that follows the block.
  if (unpatched === content && definition.rerender) {
    unpatched = stripRerenderBlock(content, definition);
  }

  // Legacy prepend blocks may have a malformed separator (`---# Heading`) from
  // safeword <=0.30.1. If the file starts with our managed marker, remove the
  // whole preamble through the first separator and preserve the customer text.
  if (unpatched === content && content.startsWith(definition.marker)) {
    const separatorIndex = content.indexOf('\n---');
    if (separatorIndex !== -1) {
      unpatched = content.slice(separatorIndex + '\n---'.length).replace(/^\n+/, '');
    }
  }

  const firstLine = content.split('\n', 1)[0] ?? '';
  if (unpatched === content && firstLine.includes(definition.marker)) {
    unpatched = content.split('\n').slice(1).join('\n').replace(/^\n+/, ''); // drop leading blanks
    unpatched = stripLeadingSafewordSeparator(unpatched);
  }

  return unpatched;
}

function executeTextUnpatch(cwd: string, path: string, definition: ResolvedTextPatch): void {
  const fullPath = nodePath.join(cwd, path);
  const content = readFileSafe(fullPath);
  if (!content) return;

  const unpatched = computeUnpatchedContent(content, definition);

  if (shouldRemoveTextPatchTarget(unpatched, definition)) {
    remove(fullPath);
    return;
  }

  writeFile(fullPath, unpatched);
}

function removeExactTextPatchContent(content: string, definition: ResolvedTextPatch): string {
  let unpatched = content.replace(definition.content, '');
  const extraContents = definition.unpatchContent ?? [];
  for (const extraContent of extraContents) {
    unpatched = unpatched.replace(extraContent, '');
  }
  return unpatched;
}

function containsTextPatchContent(content: string, definition: TextPatchDefinition): boolean {
  return (
    content.includes(definition.marker) ||
    (definition.unpatchContent?.some(extraContent => content.includes(extraContent)) ?? false)
  );
}

function shouldRemoveTextPatchTarget(content: string, definition: TextPatchDefinition): boolean {
  const trimmed = content.trim();
  return (
    definition.removeFileIfContentEquals?.some(candidate => trimmed === candidate.trim()) ?? false
  );
}
