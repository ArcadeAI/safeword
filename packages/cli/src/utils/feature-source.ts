import { existsSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

const WORKSPACE_FEATURE_ROOTS = ['packages', 'apps', 'libs', 'modules'] as const;

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

function collectExecutableFeatureDirectories(cwd: string): string[] {
  return [
    nodePath.join(cwd, 'features'),
    ...WORKSPACE_FEATURE_ROOTS.flatMap(root =>
      collectWorkspaceFeatureDirectories(nodePath.join(cwd, root)),
    ),
  ];
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
