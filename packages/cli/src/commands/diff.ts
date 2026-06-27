/**
 * Diff command - Preview changes that would be made by upgrade
 *
 * Uses reconcile() with dryRun to compute what would change.
 */

import nodePath from 'node:path';

import { type Action, reconcile } from '../reconcile.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { createProjectContext } from '../utils/context.js';
import { exists, readFileSafe, readJson } from '../utils/fs.js';
import { error, header, info, listItem, success, warn } from '../utils/output.js';
import {
  compareVersions,
  fetchRegistryLatestVersion,
  isComparableVersion,
} from '../utils/version.js';
import { VERSION } from '../version.js';

interface DiffOptions {
  verbose?: boolean;
}

interface FileDiff {
  path: string;
  status: 'added' | 'modified' | 'unchanged';
  currentContent?: string;
  newContent?: string;
}

/**
 * Local view of `.update-cache.json` (canonical shape: templates/hooks/lib/update-cache.ts).
 * `latestVersion` is `unknown` — it is untrusted cache data; validate via
 * `isComparableVersion` before use.
 */
interface UpdateCacheFile {
  latestVersion?: unknown;
}

function newerOfCliAnd(candidate: string): string {
  return compareVersions(VERSION, candidate) < 0 ? candidate : VERSION;
}

function readCachedTargetVersion(safewordDirectory: string): string | undefined {
  const cachePath = nodePath.join(safewordDirectory, '.update-cache.json');
  const cache = readJson(cachePath) as UpdateCacheFile | undefined;
  return isComparableVersion(cache?.latestVersion) ? cache.latestVersion : undefined;
}

async function resolveDiffTargetVersion(safewordDirectory: string): Promise<string> {
  const registryLatest = await fetchRegistryLatestVersion();
  if (registryLatest !== undefined) return newerOfCliAnd(registryLatest);

  const cachedLatest = readCachedTargetVersion(safewordDirectory);
  if (cachedLatest !== undefined) return newerOfCliAnd(cachedLatest);

  return VERSION;
}

function warnIfCliOlderThanProject(projectVersion: string, targetVersion: string): void {
  if (!isComparableVersion(projectVersion)) return;
  if (compareVersions(VERSION, projectVersion) >= 0) return;

  const targetSpec = compareVersions(targetVersion, projectVersion) < 0 ? 'latest' : targetVersion;
  warn(`CLI v${VERSION} is older than project v${projectVersion}.`);
  warn(`Run \`bunx safeword@${targetSpec} diff\` for an accurate preview.`);
}

/**
 * Create a unified diff between two strings
 * @param oldContent
 * @param newContent
 * @param filename
 */
function createUnifiedDiff(oldContent: string, newContent: string, filename: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const lines: string[] = [`--- a/${filename}`, `+++ b/${filename}`];

  // Simple diff - show all changes
  let hasChanges = false;

  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine: string | undefined = oldLines[i];
    const newLine: string | undefined = newLines[i];

    if (oldLine === newLine) {
      lines.push(` ${oldLine ?? ''}`);
    } else {
      hasChanges = true;
      if (oldLine !== undefined) {
        lines.push(`-${oldLine}`);
      }
      if (newLine !== undefined) {
        lines.push(`+${newLine}`);
      }
    }
  }

  if (!hasChanges) {
    return '';
  }

  // Add context marker
  lines.splice(2, 0, `@@ -1,${oldLines.length} +1,${newLines.length} @@`);

  return lines.join('\n');
}

/**
 * List files by category
 * @param categoryName
 * @param files
 */
function listFileCategory(categoryName: string, files: FileDiff[]): void {
  if (files.length === 0) return;
  info(`\n${categoryName}:`);
  for (const file of files) {
    listItem(file.path);
  }
}

/**
 * Show verbose diff output for modified files
 * @param files
 */
function showModifiedDiffs(files: FileDiff[]): void {
  for (const file of files) {
    if (!file.currentContent || !file.newContent) continue;
    info(`\n${file.path}:`);
    const diffOutput = createUnifiedDiff(file.currentContent, file.newContent, file.path);
    if (diffOutput) {
      console.log(diffOutput);
    }
  }
}

/**
 * Show verbose output for added files (truncated preview)
 * @param files
 */
function showAddedPreviews(files: FileDiff[]): void {
  for (const file of files) {
    if (!file.newContent) continue;
    info(`\n${file.path}: (new file)`);
    const allLines = file.newContent.split('\n');
    const lines = allLines.slice(0, 10);
    for (const line of lines) {
      console.log(`+${line}`);
    }
    if (allLines.length > 10) {
      console.log('... (truncated)');
    }
  }
}

/**
 * Show packages to install
 * @param packages
 */
function showPackagesToInstall(packages: string[]): void {
  if (packages.length === 0) return;
  info('\nPackages to install:');
  for (const pkg of packages) {
    listItem(pkg);
  }
}

/**
 * Convert reconcile actions to file diffs
 * @param actions
 * @param cwd
 */
function actionsToDiffs(actions: Action[], cwd: string): FileDiff[] {
  const diffs: FileDiff[] = [];
  const seenPaths = new Set<string>();

  for (const action of actions) {
    if (action.type !== 'write') {
      continue;
    }

    if (seenPaths.has(action.path)) continue;
    seenPaths.add(action.path);

    const fullPath = nodePath.join(cwd, action.path);
    const currentContent = readFileSafe(fullPath);

    if (currentContent === undefined) {
      diffs.push({
        path: action.path,
        status: 'added',
        newContent: action.content,
      });
    } else if (currentContent.trim() === action.content.trim()) {
      diffs.push({
        path: action.path,
        status: 'unchanged',
        currentContent,
        newContent: action.content,
      });
    } else {
      diffs.push({
        path: action.path,
        status: 'modified',
        currentContent,
        newContent: action.content,
      });
    }
  }

  return diffs;
}

/**
 *
 * @param options
 */
export async function diff(options: DiffOptions): Promise<void> {
  const cwd = process.cwd();
  const safewordDirectory = nodePath.join(cwd, '.safeword');

  // Check if configured
  if (!exists(safewordDirectory)) {
    error('Not configured. Run `safeword setup` first.');
    process.exit(1);
  }

  // Read project version
  const versionPath = nodePath.join(safewordDirectory, 'version');
  const projectVersion = readFileSafe(versionPath)?.trim() ?? 'unknown';
  const targetVersion = await resolveDiffTargetVersion(safewordDirectory);
  warnIfCliOlderThanProject(projectVersion, targetVersion);

  header('Safeword Diff');
  info(`Changes from v${projectVersion} → v${targetVersion}`);

  // Use reconcile with dryRun to compute changes
  const ctx = createProjectContext(cwd);
  const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx, {
    dryRun: true,
  });

  // Convert actions to file diffs
  const diffs = actionsToDiffs(result.actions, cwd);

  const added = diffs.filter(d => d.status === 'added');
  const modified = diffs.filter(d => d.status === 'modified');
  const unchanged = diffs.filter(d => d.status === 'unchanged');

  // Summary
  info(
    `\nSummary: ${added.length} added, ${modified.length} modified, ${unchanged.length} unchanged`,
  );

  // Package changes
  if (result.packagesToInstall.length > 0) {
    info(`\nPackages to install: ${result.packagesToInstall.length}`);
  }

  // List by category
  listFileCategory('Added', added);
  listFileCategory('Modified', modified);
  listFileCategory('Unchanged', unchanged);

  // Verbose output - show actual diffs
  if (options.verbose) {
    header('Detailed Changes');
    showModifiedDiffs(modified);
    showAddedPreviews(added);
    showPackagesToInstall(result.packagesToInstall);
  }

  if (added.length === 0 && modified.length === 0 && result.packagesToInstall.length === 0) {
    success('\nNo changes needed - configuration is up to date');
  } else {
    info('\nRun `safeword upgrade` to apply these changes');
  }
}
