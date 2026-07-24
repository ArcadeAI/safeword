import { existsSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { resolveConfiguredLaneDirectory } from './configured-paths.js';
import { WORKSPACE_ROOTS } from './workspaces.js';

/** Ticket folder `ID-slug` -> `slug`; legacy `ID` -> `ID`. */
function slugFromTicketFolder(ticketFolder: string): string {
  const dashIndex = ticketFolder.indexOf('-');
  return dashIndex === -1 ? ticketFolder : ticketFolder.slice(dashIndex + 1);
}

/**
 * Find the executable `.feature` file for a ticket by slug. The search mirrors
 * the Cucumber lane: all feature files under root `features/`, then under each
 * direct workspace package's `features/` directory in stable order.
 */
export function findFeatureSourcePath(cwd: string, ticketFolder: string): string | undefined {
  const fileName = `${slugFromTicketFolder(ticketFolder)}.feature`;
  return collectExecutableFeatureFiles(cwd, fileName)[0];
}

export function collectExecutableFeatureFiles(cwd: string, fileName?: string): string[] {
  return collectExecutableFeatureDirectories(cwd).flatMap(directory =>
    findFeatureFiles(directory, fileName),
  );
}

/**
 * Return every directory that contributes executable feature files.
 *
 * Keep consumers that need feature-lane coverage (for example, audit checks)
 * on this shared enumeration rather than reconstructing workspace discovery.
 */
export function collectExecutableFeatureDirectories(cwd: string): string[] {
  const directories = [
    nodePath.join(cwd, 'features'),
    ...WORKSPACE_ROOTS.flatMap(root =>
      collectWorkspaceFeatureDirectories(nodePath.join(cwd, root)),
    ),
  ];

  // paths.features AUGMENTS the defaults (ticket 56JCFZ) — relocated/host
  // lanes become readable without abandoning root features/.
  const configured = resolveConfiguredLaneDirectory(cwd, 'features');
  if (configured !== undefined && !directories.includes(configured)) {
    directories.push(configured);
  }
  return directories;
}

function collectWorkspaceFeatureDirectories(workspaceDirectory: string): string[] {
  if (!existsSync(workspaceDirectory)) return [];
  return readdirSync(workspaceDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => nodePath.join(workspaceDirectory, entry.name, 'features'));
}

function findFeatureFiles(directory: string, fileName?: string): string[] {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const matches: string[] = [];
  for (const entry of entries) {
    const absolute = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findFeatureFiles(absolute, fileName));
    } else if (entry.isFile() && isMatchingFeatureFile(entry.name, fileName)) {
      matches.push(absolute);
    }
  }
  return matches.toSorted((a, b) => a.localeCompare(b));
}

function isMatchingFeatureFile(entryName: string, fileName: string | undefined): boolean {
  if (!entryName.endsWith('.feature')) return false;
  return fileName === undefined || entryName === fileName;
}
