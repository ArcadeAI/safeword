import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkPrincipleTrace } from '../../templates/hooks/lib/principle-trace.js';

const PLAN = `# Impl Plan\n\n**Status:** implemented\n\n## Design alignment\n\n| Principle | Consequence | Proof | Conflict |\n| --- | --- | --- | --- |\n| Delight the user | Recovery stays in context | verify.md | |\n\n## Known deviations\n\nNone.\n`;
const PRINCIPLE = `## Delight the user\n\n**Intent:** Make success effortless.\n\n**Prefer:** Clear recovery.\n\n**Avoid:** Dead ends.\n\n**Evidence:** Walk the experience.\n`;

describe('checkPrincipleTrace', () => {
  const temporaryDirectories: string[] = [];

  function project(): string {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-principle-trace-'));
    temporaryDirectories.push(directory);
    mkdirSync(nodePath.join(directory, '.project'), { recursive: true });
    writeFileSync(nodePath.join(directory, '.project', 'principles.md'), PRINCIPLE);
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

  it('resolves a proof reference on its file, leaving the #fragment unjudged', () => {
    const directory = project();
    const plan = PLAN.replace('verify.md', 'verify.md#no-such-anchor');

    expect(checkPrincipleTrace(directory, plan)).toEqual([]);
  });

  it('still reports a fragment reference whose file is missing', () => {
    const directory = project();
    const plan = PLAN.replace('verify.md', 'missing.md#evidence');

    expect(checkPrincipleTrace(directory, plan)).toContain(
      '[E010] Broken principle trace: dead evidence reference: Delight the user',
    );
  });

  it('judges a second trace table in the same section', () => {
    const plan = PLAN.replace(
      '| Delight the user | Recovery stays in context | verify.md | |',
      () =>
        [
          '| Delight the user | Recovery stays in context | verify.md | |',
          '',
          '| Principle | Consequence | Proof | Conflict |',
          '| --- | --- | --- | --- |',
          '| Invented principle | Something | missing.md | |',
        ].join('\n'),
    );

    expect(checkPrincipleTrace(project(), plan)).toEqual([
      '[E010] Broken principle trace: missing source principle: Invented principle',
      '[E010] Broken principle trace: dead evidence reference: Invented principle',
    ]);
  });

  it('reads a table whose optional outer pipes are omitted', () => {
    const plan = PLAN.replace(
      '| Principle | Consequence | Proof | Conflict |\n| --- | --- | --- | --- |\n| Delight the user | Recovery stays in context | verify.md | |',
      'Principle | Consequence | Proof | Conflict\n--- | --- | --- | ---\nInvented principle | Recovery stays in context | missing.md |',
    );

    expect(checkPrincipleTrace(project(), plan)).toEqual([
      '[E010] Broken principle trace: missing source principle: Invented principle',
      '[E010] Broken principle trace: dead evidence reference: Invented principle',
    ]);
  });

  it('reports a row that carries claims but no principle name', () => {
    const plan = PLAN.replace(
      '| Delight the user | Recovery stays in context | verify.md | |',
      '|  | Recovery stays in context | missing.md | explicit-conflict |',
    );

    expect(checkPrincipleTrace(project(), plan)).toContain(
      '[E010] Broken principle trace: row has no principle name',
    );
  });

  it('ignores a wholly blank row as table noise', () => {
    const plan = PLAN.replace(
      '| Delight the user | Recovery stays in context | verify.md | |',
      '| Delight the user | Recovery stays in context | verify.md | |\n|  |  |  |  |',
    );

    expect(checkPrincipleTrace(project(), plan)).toEqual([]);
  });

  it('judges the row of a principle whose name matches the header label', () => {
    const directory = project();
    writeFileSync(
      nodePath.join(directory, '.project', 'principles.md'),
      '# Principles\n\n## Principle\n\nA project can name one exactly this.\n',
    );
    const plan = PLAN.replace(
      '| Delight the user | Recovery stays in context | verify.md | |',
      '| Principle | Recovery stays in context | missing.md | |',
    );

    // The row must be judged, not dropped as though it were the header.
    expect(checkPrincipleTrace(directory, plan)).toContain(
      '[E010] Broken principle trace: dead evidence reference: Principle',
    );
  });

  it('rejects a directory because it is not an evidence artifact', () => {
    const directory = project();
    mkdirSync(nodePath.join(directory, 'evidence-directory'));
    const plan = PLAN.replace('verify.md', 'evidence-directory');

    expect(checkPrincipleTrace(directory, plan)).toContain(
      '[E010] Broken principle trace: dead evidence reference: Delight the user',
    );
  });

  it.each(['absolute', 'parent traversal'] as const)(
    'rejects %s proof paths outside the project',
    pathKind => {
      const directory = project();
      const externalDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-external-proof-'));
      temporaryDirectories.push(externalDirectory);
      const externalProof = nodePath.join(externalDirectory, 'proof.md');
      writeFileSync(externalProof, '# External evidence\n');
      const proof =
        pathKind === 'absolute' ? externalProof : nodePath.relative(directory, externalProof);
      const plan = PLAN.replace('verify.md', () => proof);

      expect(checkPrincipleTrace(directory, plan)).toContain(
        '[E010] Broken principle trace: dead evidence reference: Delight the user',
      );
    },
  );

  it('rejects conflict values outside the plan grammar', () => {
    const plan = PLAN.replace(
      '| Delight the user | Recovery stays in context | verify.md | |',
      '| Delight the user | Recovery stays in context | verify.md | conflict |',
    );

    expect(checkPrincipleTrace(project(), plan)).toContain(
      '[E010] Broken principle trace: unsupported conflict marker: Delight the user',
    );
  });

  it('does not treat supporting sections as source principles', () => {
    const directory = project();
    writeFileSync(
      nodePath.join(directory, '.project', 'principles.md'),
      `${PRINCIPLE}\n## Further reading\n`,
    );
    const plan = PLAN.replace('Delight the user', 'Further reading');

    expect(checkPrincipleTrace(directory, plan)).toContain(
      '[E010] Broken principle trace: missing source principle: Further reading',
    );
  });

  it('does not treat the commented examples in the shipped scaffold as principles', () => {
    const directory = project();
    const scaffold = readFileSync(
      nodePath.join(__dirname, '../../templates/principles-template.md'),
      'utf8',
    );
    writeFileSync(nodePath.join(directory, '.project', 'principles.md'), scaffold);

    expect(checkPrincipleTrace(directory, PLAN)).toContain(
      '[E010] Broken principle trace: missing source principle: Delight the user',
    );
  });

  it('does not treat content after an unclosed comment as a principle', () => {
    const directory = project();
    writeFileSync(
      nodePath.join(directory, '.project', 'principles.md'),
      `# Principles\n\n<!-- guidance starts\n\n${PRINCIPLE}`,
    );

    expect(checkPrincipleTrace(directory, PLAN)).toContain(
      '[E010] Broken principle trace: missing source principle: Delight the user',
    );
  });

  it('does not let an ordinary word containing the principle name record its conflict', () => {
    const directory = project();
    writeFileSync(
      nodePath.join(directory, '.project', 'principles.md'),
      '# Principles\n\n## Test\n\nA short name a project may reasonably choose.\n',
    );
    const plan = PLAN.replace(
      '| Delight the user | Recovery stays in context | verify.md | |',
      '| Test | Recovery stays in context | verify.md | explicit-conflict |',
    ).replace('None.', 'Latest release defers documentation.');

    expect(checkPrincipleTrace(directory, plan)).toContain(
      '[E010] Broken principle trace: unrecorded conflict: Test',
    );
  });

  it('accepts a deviation that names the principle at a word boundary', () => {
    const directory = project();
    writeFileSync(
      nodePath.join(directory, '.project', 'principles.md'),
      '# Principles\n\n## Test\n\nA short name a project may reasonably choose.\n',
    );
    const plan = PLAN.replace(
      '| Delight the user | Recovery stays in context | verify.md | |',
      '| Test | Recovery stays in context | verify.md | explicit-conflict |',
    ).replace('None.', 'Test is traded away here for the reasons below.');

    expect(checkPrincipleTrace(directory, plan)).toEqual([]);
  });

  it('does not let a longer principle name satisfy a shorter one’s recorded conflict', () => {
    const directory = project();
    writeFileSync(
      nodePath.join(directory, '.project', 'principles.md'),
      '# Principles\n\n## Ship reversible changes\n\nOne command rolls it back.\n\n## Ship reversible changes safely\n\nAnd never without a down path.\n',
    );
    const plan = PLAN.replace(
      '| Delight the user | Recovery stays in context | verify.md | |',
      '| Ship reversible changes | Flag guards the path | verify.md | explicit-conflict |',
    ).replace('None.', 'Ship reversible changes safely is traded away here.');

    expect(checkPrincipleTrace(directory, plan)).toContain(
      '[E010] Broken principle trace: unrecorded conflict: Ship reversible changes',
    );
  });

  it('recognizes a principle written as a heading and prose, with no structured fields', () => {
    const directory = project();
    writeFileSync(
      nodePath.join(directory, '.project', 'principles.md'),
      '# Principles\n\n## Keep customer PII out of logs\n\nRedaction happens before anything reaches a log.\n',
    );
    const plan = PLAN.replace('Delight the user', 'Keep customer PII out of logs');

    expect(checkPrincipleTrace(directory, plan)).toEqual([]);
  });

  it('carries a pipe in a principle name through the escaped table cell', () => {
    const directory = project();
    writeFileSync(
      nodePath.join(directory, '.project', 'principles.md'),
      '# Principles\n\n## Correct and safe | then clear\n\nGates before preferences.\n',
    );
    const plan = PLAN.replace('Delight the user', String.raw`Correct and safe \| then clear`);

    expect(checkPrincipleTrace(directory, plan)).toEqual([]);
  });

  it('leaves attribution unjudged when the configured principles file is absent', () => {
    const directory = project();
    rmSync(nodePath.join(directory, '.project', 'principles.md'));

    expect(checkPrincipleTrace(directory, PLAN)).toEqual([]);
  });

  it('still checks proof references when the principles file is absent', () => {
    const directory = project();
    rmSync(nodePath.join(directory, '.project', 'principles.md'));
    const plan = PLAN.replace('verify.md', 'missing.md');

    expect(checkPrincipleTrace(directory, plan)).toEqual([
      '[E010] Broken principle trace: dead evidence reference: Delight the user',
    ]);
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
