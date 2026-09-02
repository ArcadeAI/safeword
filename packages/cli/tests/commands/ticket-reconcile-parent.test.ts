import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reconcileParentResult } from '../../src/commands/ticket-reconcile-parent.js';
import type { IdMinter } from '../../src/utils/id-minter.js';
import { createTicket } from '../../src/utils/ticket-writer.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const minter = (id: string): IdMinter => ({ mint: () => id });

const parentSpec = (outcome = 'useful value') => `# Product Plan: Epic

## Product Bet
- **Success threshold:** first customer succeeds
- **Project non-goals:** unrelated workflows

## Jobs To Be Done
### epic.NTB1 — Do the job
The parent job.

## Shape
### M1 — First milestone
- **Outcome:** ${outcome}
- **Non-goals:** later value

## Killer Demo
`;

describe('ticket reconcile-parent', () => {
  let cwd: string;
  let parentFolder: string;
  let childTicket: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
    parentFolder = createTicket(cwd, minter('EPIC01'), {
      slug: 'epic',
      type: 'epic',
    }).folderPath;
    writeFileSync(nodePath.join(parentFolder, 'spec.md'), parentSpec());
    childTicket = createTicket(cwd, minter('CHILD1'), {
      slug: 'child',
      type: 'feature',
      parent: 'EPIC01',
      milestone: 'M1',
      parentJob: 'epic.NTB1',
    }).ticketPath;
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('bootstraps once during intake and is idempotent', () => {
    expect(reconcileParentResult('CHILD1', {}, cwd).state).toBe('changed');
    const after = readFileSync(childTicket, 'utf8');
    expect(after).toMatch(/^parent_contract_digest: [a-f\d]{64}$/m);
    expect(reconcileParentResult('CHILD1', {}, cwd).state).toBe('healthy');
    expect(readFileSync(childTicket, 'utf8')).toBe(after);
  });

  it('requires explicit acceptance after parent drift', () => {
    reconcileParentResult('CHILD1', {}, cwd);
    writeFileSync(
      childTicket,
      readFileSync(childTicket, 'utf8').replace('phase: intake', 'phase: implement'),
    );
    writeFileSync(nodePath.join(parentFolder, 'spec.md'), parentSpec('changed useful value'));
    const before = readFileSync(childTicket, 'utf8');

    expect(reconcileParentResult('CHILD1', {}, cwd).state).toBe('failed');
    expect(readFileSync(childTicket, 'utf8')).toBe(before);
    expect(reconcileParentResult('CHILD1', { accept: true }, cwd).state).toBe('changed');
    expect(readFileSync(childTicket, 'utf8')).not.toBe(before);
  });

  it('does not write when a reference no longer resolves', () => {
    const before = readFileSync(childTicket, 'utf8');
    writeFileSync(nodePath.join(parentFolder, 'spec.md'), parentSpec().replace('### M1', '### M2'));
    expect(reconcileParentResult('CHILD1', {}, cwd).state).toBe('failed');
    expect(readFileSync(childTicket, 'utf8')).toBe(before);
  });

  it('rejects an unknown milestone reference', () => {
    writeFileSync(
      childTicket,
      readFileSync(childTicket, 'utf8').replace('milestone: M1', 'milestone: M9'),
    );
    expect(reconcileParentResult('CHILD1', {}, cwd).state).toBe('failed');
  });

  const expectNonContractChangeIgnored = (edit: (spec: string) => string): void => {
    reconcileParentResult('CHILD1', {}, cwd);
    const specPath = nodePath.join(parentFolder, 'spec.md');
    writeFileSync(specPath, edit(readFileSync(specPath, 'utf8')));
    expect(reconcileParentResult('CHILD1', {}, cwd).state).toBe('healthy');
  };

  it('ignores changed editorial prose outside the parent contract', () => {
    expectNonContractChangeIgnored(spec => `${spec}\nEditorial clarification.\n`);
  });

  it('ignores a changed research reference outside the parent contract', () => {
    expectNonContractChangeIgnored(spec => `${spec}\nResearch: updated source.\n`);
  });

  it('ignores changed Killer Demo wording outside the parent contract', () => {
    expectNonContractChangeIgnored(spec =>
      spec.replace('## Killer Demo', '## Killer Demo\nNew wording.'),
    );
  });
});
