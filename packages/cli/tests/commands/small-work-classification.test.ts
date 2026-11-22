import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  classifySmallWork,
  consequentialDecisions,
  type SmallWorkFacts,
} from '../../templates/hooks/lib/small-work-classification.js';
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCli,
  ticketFolderBySlug,
  ticketIdBySlug,
} from '../helpers.js';

const settled: SmallWorkFacts = {
  schemaVersion: 1,
  scope: 'Keep the existing status command',
  outcome: 'Polish the help text',
  decisions: {
    behavior: 'settled',
    'shared-contract': 'settled',
    architecture: 'settled',
    'data-ownership': 'settled',
    retention: 'settled',
    migration: 'settled',
    compatibility: 'settled',
    'proof-boundary': 'settled',
  },
  introducesUserFlow: false,
  multipleUserFlows: false,
  newPersistentState: false,
  changesSharedContract: false,
  changesBehavior: false,
  verification: 'targeted',
};

describe('small-work classification', () => {
  it.each(consequentialDecisions)('gives feature precedence to unresolved %s', decision => {
    expect(
      classifySmallWork({
        ...settled,
        decisions: { ...settled.decisions, [decision]: 'unresolved' },
      }),
    ).toMatchObject({ status: 'classified', route: 'feature' });
  });

  it.each([
    'introducesUserFlow',
    'multipleUserFlows',
    'newPersistentState',
    'changesSharedContract',
  ] as const)('gives feature precedence to %s', field => {
    expect(classifySmallWork({ ...settled, [field]: true })).toMatchObject({
      status: 'classified',
      route: 'feature',
    });
  });

  it('routes established non-behavioral work with targeted verification to patch', () => {
    expect(classifySmallWork(settled)).toMatchObject({ status: 'classified', route: 'patch' });
  });

  it('routes a private behavior correction or work needing new regression proof to task', () => {
    expect(classifySmallWork({ ...settled, changesBehavior: true })).toMatchObject({
      status: 'classified',
      route: 'task',
    });
    expect(classifySmallWork({ ...settled, verification: 'new-regression' })).toMatchObject({
      status: 'classified',
      route: 'task',
    });
  });

  it('waits on a user scope decision before applying feature precedence', () => {
    expect(
      classifySmallWork({
        ...settled,
        changesSharedContract: true,
        pendingScopeDecision: 'May the scope include changing the public response?',
      }),
    ).toMatchObject({ status: 'action_required' });
  });

  it('distinguishes missing facts from malformed inputs', () => {
    expect(classifySmallWork({ ...settled, decisions: {} })).toMatchObject({
      status: 'action_required',
    });
    expect(classifySmallWork({ ...settled, changesSharedContract: 'yes' })).toMatchObject({
      status: 'failed',
    });
  });
});

describe('classified ticket creation', () => {
  it('uses feature precedence over a declared patch at the built CLI entry point', async () => {
    const project = createTemporaryDirectory();
    try {
      const result = await runCli(
        [
          'ticket',
          'new',
          'public-contract',
          '--type',
          'patch',
          '--small-work-facts',
          JSON.stringify({ ...settled, changesSharedContract: true }),
          '--json',
        ],
        { cwd: project },
      );
      expect(result.exitCode, result.stderr || result.stdout).toBe(0);
      const ticket = ticketFolderBySlug(project, 'public-contract');
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(/^type: feature$/m);
      expect(existsSync(nodePath.join(ticket, 'spec.md'))).toBe(true);
    } finally {
      removeTemporaryDirectory(project);
    }
  });

  it('keeps classified task facts inline without creating feature plans', async () => {
    const project = createTemporaryDirectory();
    try {
      const result = await runCli(
        [
          'ticket',
          'new',
          'private-retry',
          '--small-work-facts',
          JSON.stringify({ ...settled, changesBehavior: true }),
          '--json',
        ],
        { cwd: project },
      );
      expect(result.exitCode, result.stderr || result.stdout).toBe(0);
      const ticket = ticketFolderBySlug(project, 'private-retry');
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toContain(
        '## Safeword small-work facts',
      );
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toContain(
        '## Delivery Checklist',
      );
      expect(existsSync(nodePath.join(ticket, 'spec.md'))).toBe(false);
      expect(existsSync(nodePath.join(ticket, 'execution-plan.md'))).toBe(false);
      const id = ticketIdBySlug(project, 'private-retry');
      const checklist = await runCli(['ticket', 'delivery-checklist', id, '--json'], {
        cwd: project,
      });
      expect(checklist.exitCode).toBe(2);
      expect(JSON.parse(checklist.stdout)).toMatchObject({
        data: { open_contributor_items: ['verification'], grants_merge_authority: false },
      });
    } finally {
      removeTemporaryDirectory(project);
    }
  });
});
