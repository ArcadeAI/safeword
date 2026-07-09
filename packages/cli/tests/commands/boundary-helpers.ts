/**
 * Shared fixtures for the boundary command suites (CDRJTW cross-scenario
 * refactor): git shell-outs, audit-record reading, and ticket.md builders —
 * extracted from their triplicated copies in boundary*.test.ts.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { createConfiguredProject, createTemporaryDirectory, writeTestFile } from '../helpers';

export const AUDIT_PATH = '.safeword/boundary-audit.jsonl';

/** A configured temp project with everything committed as the baseline. */
export async function createBoundaryProject(): Promise<string> {
  const dir = createTemporaryDirectory();
  await createConfiguredProject(dir);
  git(dir, 'add -A');
  git(dir, 'commit -m baseline --quiet');
  return dir;
}

/**
 * A boundary project wired to a bare remote with a pushed baseline holding
 * `content` at `ticketPath` — the push-tier suites' shared opening position.
 */
export async function createBoundaryPushFixture(
  ticketPath: string,
  content: string,
): Promise<{ dir: string; remote: string }> {
  const dir = createTemporaryDirectory();
  const remote = createTemporaryDirectory();
  await createConfiguredProject(dir);
  execSync('git init --bare --quiet', { cwd: remote, stdio: 'pipe' });
  git(dir, `remote add origin ${remote}`);
  writeTestFile(dir, ticketPath, content);
  git(dir, 'add -A');
  git(dir, 'commit -m baseline --quiet');
  git(dir, 'push -u origin HEAD --quiet');
  return { dir, remote };
}

export function git(dir: string, command: string): string {
  return execSync(`git ${command}`, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
}

/** Read parsed audit entries, or [] when the record doesn't exist yet. */
export function readAudit(dir: string): Record<string, unknown>[] {
  const auditFile = nodePath.join(dir, AUDIT_PATH);
  if (!existsSync(auditFile)) return [];
  return readFileSync(auditFile, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

/** A minimal impl-plan.md that passes parseImplPlan — the implement anchor's artifact. */
export function shapeValidImplPlan(): string {
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

/** ticket.md content builder shared across boundary fixtures. */
export function boundaryTicketContent(options: {
  id?: string;
  type?: string;
  phase: string;
  anchors?: string[];
  skips?: string[];
}): string {
  const lines = [
    '---',
    `id: ${options.id ?? 'ZZBND'}`,
    `type: ${options.type ?? 'feature'}`,
    `phase: ${options.phase}`,
    'status: in_progress',
  ];
  if (options.anchors) {
    lines.push('phase_anchors:');
    for (const entry of options.anchors) lines.push(`  - ${entry}`);
  }
  if (options.skips) {
    lines.push('phase_skips:');
    for (const entry of options.skips) lines.push(`  - ${entry}`);
  }
  lines.push('---', '', '# Fixture', '');
  return lines.join('\n');
}
