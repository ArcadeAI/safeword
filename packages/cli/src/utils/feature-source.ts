import { existsSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

const SKIP_DIRECTORIES = new Set([
  '.git',
  '.project',
  '.safeword',
  '.safeword-project',
  '.claude',
  '.cursor',
  'coverage',
  'dist',
  'node_modules',
]);

const MAX_SEARCH_DEPTH = 5;

/** Ticket folder `ID-slug` -> `slug`; legacy `ID` -> `ID`. */
export function slugFromTicketFolder(ticketFolder: string): string {
  const dashIndex = ticketFolder.indexOf('-');
  return dashIndex === -1 ? ticketFolder : ticketFolder.slice(dashIndex + 1);
}

/**
 * Find the `.feature` file for a ticket by slug. Root `features/<slug>.feature`
 * wins, then package-level feature directories in stable order.
 */
export function findFeatureSourcePath(cwd: string, ticketFolder: string): string | undefined {
  const fileName = `${slugFromTicketFolder(ticketFolder)}.feature`;
  const rootCandidate = nodePath.join(cwd, 'features', fileName);
  if (existsSync(rootCandidate)) return rootCandidate;
  return findFeatureFiles(cwd, fileName)[0];
}

function findFeatureFiles(directory: string, fileName: string, depth = 0): string[] {
  if (depth > MAX_SEARCH_DEPTH) return [];

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
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      matches.push(...findFeatureFiles(absolute, fileName, depth + 1));
    } else if (
      entry.isFile() &&
      entry.name === fileName &&
      nodePath.basename(directory) === 'features'
    ) {
      matches.push(absolute);
    }
  }
  return matches.toSorted((a, b) => a.localeCompare(b));
}
