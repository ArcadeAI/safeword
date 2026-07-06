/**
 * Shared fixtures for the boundary command suites (CDRJTW cross-scenario
 * refactor): git shell-outs, audit-record reading, and ticket.md builders —
 * extracted from their triplicated copies in boundary*.test.ts.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

export const AUDIT_PATH = '.safeword/boundary-audit.jsonl';

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
