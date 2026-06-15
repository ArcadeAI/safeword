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

/**
 * Get conditional packages based on project type.
 * Handles the "standard" key and prettier filtering for existing formatters.
 */
function getConditionalPackages(
  conditionalPackages: Record<string, string[]>,
  projectType: ProjectType,
): string[] {
  const packages: string[] = [];

  for (const [key, deps] of Object.entries(conditionalPackages)) {
    // "standard" means !existingFormatter - only for projects without existing formatter
    if (key === 'standard') {
      if (!projectType.existingFormatter) {
        packages.push(...deps);
      }
      continue;
    }

    // Check if this condition is met
    if (projectType[key as keyof ProjectType]) {
      // For projects with existing formatter, skip prettier-related packages
      if (projectType.existingFormatter) {
        packages.push(...deps.filter(pkg => !PRETTIER_PACKAGES.has(pkg)));
      } else {
        packages.push(...deps);
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
function planTextPatches(
  patches: Record<string, TextPatchDefinition>,
  cwd: string,
  isGitRepo: boolean,
): Action[] {
  const actions: Action[] = [];
  for (const [filePath, definition] of Object.entries(patches)) {
    if (shouldSkipForNonGit(filePath, isGitRepo)) continue;
    if (!passesTextPatchContentGuard(cwd, filePath, definition)) continue;
    actions.push({ type: 'text-patch', path: filePath, definition });
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
    if (exists(nodePath.join(cwd, dir))) {
      actions.push({ type: 'rmdir', path: dir });
      removed.push(dir);
    }
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
    if (exists(nodePath.join(cwd, filePath))) {
      actions.push({ type: 'rm', path: filePath });
      removed.push(filePath);
    }
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
  | { type: 'text-patch'; path: string; definition: TextPatchDefinition }
  | { type: 'text-unpatch'; path: string; definition: TextPatchDefinition };

export interface ReconcileResult {
  actions: Action[];
  applied: boolean;
  created: string[];
  updated: string[];
  removed: string[];
  packagesToInstall: string[];
  packagesToRemove: string[];
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
      Object.entries(schema.managedFiles).map(([path, definition]) => [
        translate(path),
        definition,
      ]),
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
  const dryRun = options?.dryRun ?? false;

  const plan = computePlan(withResolvedNamespaceRoot(schema, ctx), mode, ctx);

  if (dryRun) {
    return {
      actions: plan.actions,
      applied: false,
      created: plan.wouldCreate,
      updated: plan.wouldUpdate,
      removed: plan.wouldRemove,
      packagesToInstall: plan.packagesToInstall,
      packagesToRemove: plan.packagesToRemove,
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
  const textPatchActions = planTextPatches(schema.textPatches, ctx.cwd, ctx.isGitRepo);
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

/**
 * Plan actions for managed files (only create if missing).
 *
 * Entries with a `configKey` whose `paths.<configKey>` override is set in
 * `.safeword/config.json` are suppressed — the user has redirected
 * safeword to read from elsewhere, so the default location is no longer
 * safeword's concern (ticket K7N2QM).
 */
function planManagedFilesActions(
  managedFiles: Record<string, ManagedFileDefinition>,
  ctx: ProjectContext,
): FileActionResult {
  const actions: Action[] = [];
  const created: string[] = [];

  for (const [filePath, definition] of Object.entries(managedFiles)) {
    if (isConfigOverridden(definition, ctx.cwd)) continue;

    const fullPath = nodePath.join(ctx.cwd, filePath);
    const newContent = resolveFileContent(definition, ctx);

    if (newContent === undefined) continue;
    if (exists(fullPath)) continue; // Don't update during upgrade

    actions.push({ type: 'write', path: filePath, content: newContent });
    created.push(filePath);
  }

  return { actions, created, updated: [] };
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

  // 3. Create missing managed files (don't update existing)
  const managedFilesResult = planManagedFilesActions(schema.managedFiles, ctx);
  actions.push(...managedFilesResult.actions);
  wouldCreate.push(...managedFilesResult.created);

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
  actions.push(...planTextPatches(schema.textPatches, ctx.cwd, ctx.isGitRepo));

  // 8. Compute packages to install
  const packagesToInstall = computePackagesToInstall(
    schema,
    ctx.projectType,
    ctx.developmentDeps,
    ctx.cwd,
  );

  // 9. Compute deprecated packages to remove (only those actually installed)
  const packagesToRemove = schema.deprecatedPackages.filter(pkg => pkg in ctx.developmentDeps);

  return {
    actions,
    wouldCreate,
    wouldUpdate,
    wouldRemove,
    packagesToInstall,
    packagesToRemove,
  };
}

function computeUninstallPlan(
  schema: SafewordSchema,
  ctx: ProjectContext,
  full: boolean,
): ReconcilePlan {
  const actions: Action[] = [];
  const wouldRemove: string[] = [];

  // 1. Remove all owned files and track parent dirs for cleanup
  const ownedFiles = planExistingFilesRemoval(Object.keys(schema.ownedFiles), ctx.cwd);
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

  // 2. JSON unmerges
  for (const [filePath, definition] of Object.entries(schema.jsonMerges)) {
    actions.push({ type: 'json-unmerge', path: filePath, definition });
  }

  // 3. Text unpatches
  for (const [filePath, definition] of Object.entries(schema.textPatches)) {
    const fullPath = nodePath.join(ctx.cwd, filePath);
    if (exists(fullPath)) {
      const content = readFileSafe(fullPath) ?? '';
      if (containsTextPatchContent(content, definition)) {
        actions.push({ type: 'text-unpatch', path: filePath, definition });
      }
    }
  }

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
}

function executePlan(plan: ReconcilePlan, ctx: ProjectContext): ExecutionResult {
  const created: string[] = [];
  const updated: string[] = [];
  const removed: string[] = [];
  const result = { created, updated, removed };

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

function executeAction(action: Action, ctx: ProjectContext, result: ExecutionResult): void {
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
    case 'json-merge': {
      executeJsonMerge(ctx.cwd, action.path, action.definition, ctx);
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
  }
}

function executeWrite(cwd: string, path: string, content: string, result: ExecutionResult): void {
  const fullPath = nodePath.join(cwd, path);
  const existed = exists(fullPath);
  writeFile(fullPath, content);
  (existed ? result.updated : result.created).push(path);
}

// ============================================================================
// Helper functions
// ============================================================================

function resolveFileContent(definition: FileDefinition, ctx: ProjectContext): string | undefined {
  if (definition.template) {
    const templatesDirectory = getTemplatesDirectory();
    return readFile(nodePath.join(templatesDirectory, definition.template));
  }

  if (definition.content) {
    return typeof definition.content === 'function' ? definition.content() : definition.content;
  }

  if (definition.generator) {
    // Generator can return null to skip file creation
    return definition.generator(ctx);
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
  installedDevelopmentDeps: Record<string, string>,
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
    return !workspaceMembers.has(name) && !(name in installedDevelopmentDeps);
  });
}

function computePackagesToRemove(
  schema: SafewordSchema,
  projectType: ProjectType,
  installedDevelopmentDeps: Record<string, string>,
): string[] {
  const safewordPackages = [
    ...schema.packages.base,
    ...getConditionalPackages(schema.packages.conditional, projectType),
  ];

  // Only remove packages that are actually installed
  // Strip version specifier (e.g. 'eslint@^9' → 'eslint') when checking installed deps
  return safewordPackages.filter(pkg => stripVersionSpecifier(pkg) in installedDevelopmentDeps);
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
): void {
  const fullPath = nodePath.join(cwd, path);
  const rawExisting = readJson(fullPath) as Record<string, unknown> | undefined;

  // Skip if file doesn't exist and skipIfMissing is set
  if (!rawExisting && definition.skipIfMissing) return;

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

function executeTextPatch(cwd: string, path: string, definition: TextPatchDefinition): void {
  const fullPath = nodePath.join(cwd, path);
  let content = readFileSafe(fullPath) ?? '';

  // Check if already patched
  if (content.includes(definition.marker)) {
    // Heal legacy artifact from safeword <=0.30.1: the prepend templates
    // (CLAUDE_MD_IMPORT_BLOCK, AGENTS_MD_LINK) ended with bare `---` and no
    // trailing newline, so the `---` separator glued to the user's first
    // heading line (e.g. `---# CLAUDE.md`). Templates are fixed going
    // forward; this pass repairs files already corrupted by past installs.
    // Narrowly scoped: only fires when the safeword marker is present
    // (proving the block was authored by us) and the exact artifact matches.
    if (content.includes('\n\n---#')) {
      const healed = content.replaceAll('\n\n---#', '\n\n---\n\n#');
      writeFile(fullPath, healed);
    }
    return;
  }

  // Apply patch
  content =
    definition.operation === 'prepend'
      ? definition.content + content
      : content + definition.content;

  writeFile(fullPath, content);
}

function executeTextUnpatch(cwd: string, path: string, definition: TextPatchDefinition): void {
  const fullPath = nodePath.join(cwd, path);
  const content = readFileSafe(fullPath);
  if (!content) return;

  let unpatched = removeExactTextPatchContent(content, definition);

  // If full content wasn't found but marker exists, remove lines containing the marker
  if (unpatched === content && content.includes(definition.marker)) {
    // Remove lines containing the marker
    const lines = content.split('\n');
    const filtered = lines.filter(line => !line.includes(definition.marker));
    unpatched = filtered.join('\n').replace(/^\n+/, ''); // Remove leading empty lines
  }

  if (shouldRemoveTextPatchTarget(unpatched, definition)) {
    remove(fullPath);
    return;
  }

  writeFile(fullPath, unpatched);
}

function removeExactTextPatchContent(content: string, definition: TextPatchDefinition): string {
  let unpatched = content.replace(definition.content, '');
  for (const extraContent of definition.unpatchContent ?? []) {
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
