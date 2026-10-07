import { mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { assertTestCliFresh, runCli } from '../helpers.js';

describe('unreadable Delivery Checklist plan', () => {
  beforeAll(assertTestCliFresh);

  it('blocks the installed CLI with one repair and does not regenerate the plan', async () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-delivery-unreadable-'));
    const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-feature');
    const planPath = nodePath.join(ticketDirectory, 'execution-plan.md');
    mkdirSync(planPath, { recursive: true });
    writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), '---\ntype: feature\n---\n');

    const invoked = await runCli(
      ['ticket', 'record-delivery-proof', 'ABC123', 'item-4', 'proof', '--json', '--cwd', root],
      { cwd: root, env: { NODE_ENV: 'test' } },
    );
    const result = JSON.parse(invoked.stdout) as {
      state: string;
      findings: { code: string; message: string; severity: string }[];
      recovery: { command: string }[];
    };

    expect(invoked.exitCode, invoked.stdout).toBe(2);
    expect(result.state).toBe('action_required');
    expect(result.findings).toEqual([
      {
        code: 'execution_plan_unreadable',
        message:
          'Could not read .project/tickets/ABC123-feature/execution-plan.md. Repair the named Execution Plan before updating its Delivery Checklist.',
        severity: 'warning',
      },
    ]);
    expect(result.recovery.map(action => action.command)).toEqual([
      'Repair .project/tickets/ABC123-feature/execution-plan.md and rerun plan-execution review.',
    ]);
    expect(statSync(planPath).isDirectory()).toBe(true);
  });
});
