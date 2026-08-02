import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkPrincipleTrace } from '../../templates/hooks/lib/principle-trace.js';

const PLAN = `# Impl Plan\n\n**Status:** implemented\n\n## Design alignment\n\n| Principle | Consequence | Proof | Conflict |\n| --- | --- | --- | --- |\n| Delight the user | Recovery stays in context | verify.md | |\n\n## Known deviations\n\nNone.\n`;

describe('checkPrincipleTrace', () => {
  const temporaryDirectories: string[] = [];

  function project(): string {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-principle-trace-'));
    temporaryDirectories.push(directory);
    mkdirSync(nodePath.join(directory, '.project'), { recursive: true });
    writeFileSync(nodePath.join(directory, '.project', 'principles.md'), '## Delight the user\n');
    writeFileSync(nodePath.join(directory, 'verify.md'), '# Evidence\n');
    return directory;
  }

  afterEach(() => {
    for (const directory of temporaryDirectories) {
      rmSync(directory, { recursive: true, force: true });
    }
    temporaryDirectories.length = 0;
  });

  it('accepts a complete trace even when semantic judgment disputes it', () => {
    expect(checkPrincipleTrace(project(), PLAN)).toEqual([]);
  });

  it.each([
    ['Unknown principle', 'Recovery stays in context', 'verify.md', '', 'missing source principle'],
    ['Delight the user', '', 'verify.md', '', 'incomplete principle mapping'],
    ['Delight the user', 'Recovery stays in context', 'missing.md', '', 'dead evidence reference'],
    [
      'Delight the user',
      'Recovery stays in context',
      'verify.md',
      'explicit-conflict',
      'unrecorded conflict',
    ],
  ])('reports %s trace defects as E010', (principle, consequence, proof, conflict, detail) => {
    const plan = PLAN.replace(
      '| Delight the user | Recovery stays in context | verify.md | |',
      () => `| ${principle} | ${consequence} | ${proof} | ${conflict} |`,
    );

    expect(checkPrincipleTrace(project(), plan)).toContain(
      `[E010] Broken principle trace: ${detail}: ${principle}`,
    );
  });

  it('reports active-ticket findings through the installed audit entry point', () => {
    const directory = project();
    const ticketDirectory = nodePath.join(directory, '.project', 'tickets', 'TRACE1');
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), '---\nstatus: in_progress\n---\n');
    writeFileSync(
      nodePath.join(ticketDirectory, 'impl-plan.md'),
      PLAN.replace('verify.md', 'missing.md'),
    );
    const wrapper = nodePath.join(__dirname, '../../templates/hooks/audit-principle-trace.ts');

    const result = spawnSync('bun', [wrapper, directory], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[E010] Broken principle trace: dead evidence reference');
  });
});
