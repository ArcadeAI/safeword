/**
 * Shared temp-repo fixture helpers for the boundary/anchor acceptance step
 * files (HGYGND quality-review follow-through): git shell-outs, file writing,
 * the audit-record location and reader, and the shape-valid impl-plan the
 * implement anchor points at — one copy behind both step files, no drift.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

export const AUDIT_PATH = '.safeword/boundary-audit.jsonl';

export function git(dir: string, command: string): string {
  return execSync(`git ${command}`, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
}

export function writeFileAt(dir: string, relative: string, content: string): void {
  const full = nodePath.join(dir, relative);
  mkdirSync(nodePath.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** Parsed audit entries at `dir`, or [] when the record doesn't exist yet. */
export function readAuditEntries(dir: string): Array<Record<string, unknown>> {
  const auditFile = nodePath.join(dir, AUDIT_PATH);
  if (!existsSync(auditFile)) return [];
  return readFileSync(auditFile, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

/** A minimal impl-plan.md that passes parseImplPlan — the implement anchor's artifact. */
export function implPlanContent(): string {
  return [
    '# Impl Plan: fixture',
    '',
    '**Status:** planned',
    '',
    '## Approach',
    '',
    'Do the fixture work.',
    '',
    '## Decisions',
    '',
    'skip: fixture',
    '',
    '## Arch alignment',
    '',
    'skip: fixture',
    '',
    '## Known deviations',
    '',
    'skip: fixture',
    '',
    '## Assessment triggers',
    '',
    'skip: fixture',
    '',
  ].join('\n');
}
