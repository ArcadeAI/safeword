/**
 * Wiring tests for `safeword migrate-ac` (ticket 1SVCB9, TB1). Drives the real
 * cli -> command -> filesystem path on a temp project, mocking nothing but the
 * process boundary. The pure transform logic is unit-tested in
 * src/utils/migrate-ac.test.ts; here we prove discovery + read/write wiring.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createConfiguredProject,
  createTemporaryDirectory,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

describe('safeword migrate-ac', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  const spec = (body: string): string =>
    `# Spec\n\n## Jobs To Be Done\n\n### demo.SM1 — Trace\n\n**Persona:** SM\n\n${body}\n`;

  const feature = (tag: string): string =>
    `Feature: Demo\n\n  Rule: r\n\n    ${tag}\n    Scenario: x\n      Given a\n      When b\n      Then c\n`;

  function writeTicket(folder: string, files: Record<string, string>): void {
    writeTestFile(
      temporaryDirectory,
      `.project/tickets/${folder}/ticket.md`,
      [
        '---',
        `id: ${folder.split('-', 1)[0]}`,
        'type: feature',
        'status: in_progress',
        '---',
        '',
      ].join('\n'),
    );
    for (const [name, content] of Object.entries(files)) {
      writeTestFile(temporaryDirectory, `.project/tickets/${folder}/${name}`, content);
    }
  }

  it('TB1.R1: rewrites spec headings, feature tags, and ledger refs across a ticket', async () => {
    await createConfiguredProject(temporaryDirectory);
    writeTicket('MIG001-demo', {
      'spec.md': spec('#### demo.SM1.AC1 — cap one\n\n#### demo.SM1.AC2 — cap two'),
      'test-definitions.md': '# Test Definitions\n\n### Scenario: demo.SM1.AC1.happy\n',
    });
    writeTestFile(temporaryDirectory, 'features/demo.feature', feature('@demo.SM1.AC1'));

    const result = await runCli(['migrate-ac'], { cwd: temporaryDirectory });

    expect(result.exitCode).toBe(0);
    const specContent = readTestFile(temporaryDirectory, '.project/tickets/MIG001-demo/spec.md');
    expect(specContent).toContain('#### demo.SM1.R1 — cap one');
    expect(specContent).toContain('#### demo.SM1.R2 — cap two');
    expect(specContent).not.toMatch(/\.AC\d/);
    expect(readTestFile(temporaryDirectory, 'features/demo.feature')).toContain('@demo.SM1.R1');
    expect(
      readTestFile(temporaryDirectory, '.project/tickets/MIG001-demo/test-definitions.md'),
    ).toContain('### Scenario: demo.SM1.R1.happy');
  });

  it('TB1.R2: --dry-run reports the rewrites but writes no file', async () => {
    await createConfiguredProject(temporaryDirectory);
    const original = spec('#### demo.SM1.AC1 — cap');
    writeTicket('MIG002-demo', { 'spec.md': original });

    const result = await runCli(['migrate-ac', '--dry-run'], { cwd: temporaryDirectory });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/would migrate/i);
    expect(readTestFile(temporaryDirectory, '.project/tickets/MIG002-demo/spec.md')).toBe(original);
  });

  it('TB1.R2: re-running on already-migrated files changes nothing', async () => {
    await createConfiguredProject(temporaryDirectory);
    writeTicket('MIG003-demo', { 'spec.md': spec('#### demo.SM1.R1 — already a rule') });

    const result = await runCli(['migrate-ac'], { cwd: temporaryDirectory });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/No \.AC references found/i);
  });

  it('TB1.R2: a colliding ticket is refused and left unchanged while a clean ticket migrates', async () => {
    await createConfiguredProject(temporaryDirectory);
    const colliding = spec('#### demo.SM1.AC1 — cap\n\n#### demo.SM1.R1 — invariant');
    writeTicket('MIG004-collide', { 'spec.md': colliding });
    writeTicket('MIG005-clean', { 'spec.md': spec('#### demo.SM1.AC1 — cap') });

    const result = await runCli(['migrate-ac'], { cwd: temporaryDirectory });

    const combined = `${result.stdout}\n${result.stderr}`;
    expect(combined).toMatch(/refused.*MIG004-collide.*collide/is);
    // colliding spec untouched...
    expect(readTestFile(temporaryDirectory, '.project/tickets/MIG004-collide/spec.md')).toBe(
      colliding,
    );
    // ...clean spec migrated.
    expect(readTestFile(temporaryDirectory, '.project/tickets/MIG005-clean/spec.md')).toContain(
      '#### demo.SM1.R1 — cap',
    );
  });
});
