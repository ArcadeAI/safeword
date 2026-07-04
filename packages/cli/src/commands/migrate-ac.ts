/**
 * `safeword migrate-ac` — rewrite a project's legacy `.AC<n>` criteria spelling
 * to the single Rule tier `.R<n>` (ticket 1SVCB9, TB1).
 *
 * Processes each active ticket as a unit: its spec.md declarations (collision-
 * aware), then its test-definitions.md and `.feature` references. A spec whose
 * JTBD would collide an AC number onto an existing Rule number refuses the whole
 * ticket unit (never a silent renumber) and is reported. `completed/` tickets are
 * left frozen. `--dry-run` reports the rewrites without writing.
 */

import { readdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { resolveTicketsDirectory } from '../utils/configured-paths.js';
import { findFeatureSourcePath } from '../utils/feature-source.js';
import { readFileSafe } from '../utils/fs.js';
import { migrateReferencesAc, migrateSpecAc } from '../utils/migrate-ac.js';
import { header, info, success, warn } from '../utils/output.js';

export interface MigrateAcOptions {
  dryRun?: boolean;
}

interface MigrateAcReport {
  /** Repo-relative paths written (or, in dry-run, that would be written). */
  migrated: string[];
  /** Ticket specs refused for an AC/Rule number collision. */
  refused: { path: string; jtbds: string[] }[];
}

export function migrateAc(options: MigrateAcOptions = {}): Promise<void> {
  const dryRun = options.dryRun ?? false;
  const report = runMigrateAc(process.cwd(), dryRun);

  header(dryRun ? 'migrate-ac (dry run)' : 'migrate-ac');
  for (const path of report.migrated) {
    info(`${dryRun ? 'would migrate' : 'migrated'}: ${path}`);
  }
  for (const refusal of report.refused) {
    warn(
      `refused ${refusal.path}: AC and Rule numbers collide under ${refusal.jtbds.join(', ')} — resolve by hand, then re-run`,
    );
  }

  if (report.migrated.length === 0 && report.refused.length === 0) {
    success('No .AC references found — already on the Rule tier.');
  } else {
    success(
      `${report.migrated.length} file(s) ${dryRun ? 'would migrate' : 'migrated'}, ${report.refused.length} refused.`,
    );
  }
  return Promise.resolve();
}

/** Rewrite `.AC` -> `.R` across active ticket units; returns what changed. */
export function runMigrateAc(cwd: string, dryRun: boolean): MigrateAcReport {
  const migrated: string[] = [];
  const refused: { path: string; jtbds: string[] }[] = [];
  const ticketsRoot = resolveTicketsDirectory(cwd);

  for (const ticketFolder of activeTicketFolders(ticketsRoot)) {
    const outcome = migrateTicket(
      cwd,
      nodePath.join(ticketsRoot, ticketFolder),
      ticketFolder,
      dryRun,
    );
    migrated.push(...outcome.migrated);
    if (outcome.refused !== undefined) refused.push(outcome.refused);
  }

  return { migrated, refused };
}

/** Migrate one ticket unit: spec declarations (collision-aware), then its
 * ledger and feature references. A colliding spec refuses the whole unit. */
function migrateTicket(
  cwd: string,
  ticketDirectory: string,
  ticketFolder: string,
  dryRun: boolean,
): { migrated: string[]; refused?: { path: string; jtbds: string[] } } {
  const migrated: string[] = [];
  const specPath = nodePath.join(ticketDirectory, 'spec.md');
  const specContent = readFileSafe(specPath);

  if (specContent !== undefined) {
    const result = migrateSpecAc(specContent);
    if (result.collisions.length > 0) {
      return {
        migrated,
        refused: { path: nodePath.relative(cwd, specPath), jtbds: result.collisions },
      };
    }
    if (result.changed) {
      write(specPath, result.content, dryRun);
      migrated.push(nodePath.relative(cwd, specPath));
    }
  }

  for (const referencePath of [
    nodePath.join(ticketDirectory, 'test-definitions.md'),
    findFeatureSourcePath(cwd, ticketFolder),
  ]) {
    const written = migrateReferenceFile(cwd, referencePath, dryRun);
    if (written !== undefined) migrated.push(written);
  }
  return { migrated };
}

/** Migrate one reference file (ledger or feature); returns its relative path if
 * changed, else undefined. */
function migrateReferenceFile(
  cwd: string,
  referencePath: string | undefined,
  dryRun: boolean,
): string | undefined {
  if (referencePath === undefined) return undefined;
  const content = readFileSafe(referencePath);
  if (content === undefined) return undefined;
  const result = migrateReferencesAc(content);
  if (!result.changed) return undefined;
  write(referencePath, result.content, dryRun);
  return nodePath.relative(cwd, referencePath);
}

/**
 * In-progress ticket folder names under the tickets root. Scoped to
 * `status: in_progress` — the same live surface `safeword check`'s coverage and
 * the `.AC` deprecation nudge act on — so migration stays in step with what the
 * tooling flags. Done and `completed/` tickets are frozen records, left as-is.
 */
function activeTicketFolders(ticketsRoot: string): string[] {
  try {
    return readdirSync(ticketsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name !== 'completed')
      .map(entry => entry.name)
      .filter(folder => isInProgressTicket(nodePath.join(ticketsRoot, folder)));
  } catch {
    return [];
  }
}

/** Whether a ticket directory's `ticket.md` frontmatter is `status: in_progress`. */
function isInProgressTicket(ticketDirectory: string): boolean {
  const content = readFileSafe(nodePath.join(ticketDirectory, 'ticket.md'));
  if (content === undefined) return false;
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') return false;
  for (let index = 1; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').trim();
    if (line === '---') return false;
    if (line === 'status: in_progress') return true;
  }
  return false;
}

function write(path: string, content: string, dryRun: boolean): void {
  if (!dryRun) writeFileSync(path, content);
}
