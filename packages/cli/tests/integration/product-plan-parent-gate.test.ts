import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveParentContract } from '../../src/utils/product-plan-contract.js';

const root = nodePath.resolve(import.meta.dirname, '../../../..');
const preTool = nodePath.join(root, 'packages/cli/templates/hooks/pre-tool-quality.ts');
const stop = nodePath.join(root, 'packages/cli/templates/hooks/stop-quality.ts');

describe('child Product Plan phase boundaries', () => {
  let project: string;
  let childTicket: string;

  beforeEach(() => {
    project = mkdtempSync(nodePath.join(tmpdir(), 'product-plan-gate-'));
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(project, '.project/tickets/EPIC01-parent'), { recursive: true });
    mkdirSync(nodePath.join(project, '.project/tickets/CHILD1-child'), { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword/config.json'), '{}');
    writeFileSync(
      nodePath.join(project, '.project/tickets/EPIC01-parent/ticket.md'),
      '---\nid: EPIC01\ntype: epic\nstatus: in_progress\n---\n',
    );
    writeFileSync(
      nodePath.join(project, '.project/tickets/EPIC01-parent/spec.md'),
      '# Product Plan\n\n## Product Bet\n\n- **Success threshold:** live\n- **Project non-goals:** none\n\n## Jobs To Be Done\n\n### parent.PLO1 — job\n\n## Shape\n\n### M1 — first\n\n- **Outcome:** value\n- **Non-goals:** none\n',
    );
    childTicket = nodePath.join(project, '.project/tickets/CHILD1-child/ticket.md');
    writeFileSync(
      childTicket,
      '---\nid: CHILD1\ntype: feature\nphase: intake\nstatus: in_progress\nproduct_plan_contract: v1\nparent: EPIC01\nparent_job: parent.PLO1\nmilestone: M1\nscope: local\nout_of_scope: none\ndone_when: works\n---\n',
    );
    writeFileSync(
      nodePath.join(project, '.project/tickets/CHILD1-child/test-definitions.md'),
      '# Test Definitions\n\n- [ ] scenario\n',
    );
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it('blocks intake exit when the BDD bootstrap was skipped', () => {
    const result = spawnSync('bun', [preTool], {
      input: JSON.stringify({
        tool_name: 'Edit',
        tool_input: {
          file_path: childTicket,
          old_string: 'phase: intake',
          new_string: 'phase: define-behavior',
        },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    });
    expect(result.stdout).toContain('has not been reconciled');
    expect(result.stdout).toContain('ticket reconcile-parent');
  });

  it('blocks a phase change that removes the child lineage in the same edit', () => {
    const result = spawnSync('bun', [preTool], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: {
          file_path: childTicket,
          content:
            '---\nid: CHILD1\ntype: feature\nphase: define-behavior\nstatus: in_progress\nproduct_plan_contract: v1\nscope: local\nout_of_scope: none\ndone_when: works\n---\n',
        },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    });
    expect(result.stdout).toContain('parent references cannot be removed');
  });

  it('blocks lineage removal before a later phase-advance edit', () => {
    const prior = readFileSync(childTicket, 'utf8');
    const content = prior
      .replace('product_plan_contract: v1\n', '')
      .replace('parent_job: parent.PLO1\n', '')
      .replace('milestone: M1\n', '');
    const result = spawnSync('bun', [preTool], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: childTicket, content },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    });
    expect(result.stdout).toContain('parent, parent_job, and milestone must be declared together');
  });

  it('does not apply the contracted-child removal gate to legacy parent metadata', () => {
    writeFileSync(
      childTicket,
      '---\nid: CHILD1\ntype: feature\nphase: intake\nstatus: in_progress\nparent: EPIC01\n---\n',
    );
    const content = readFileSync(childTicket, 'utf8')
      .replace('phase: intake', 'phase: define-behavior')
      .replace('parent: EPIC01\n', '');
    const result = spawnSync('bun', [preTool], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: childTicket, content },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    });
    expect(result.stdout).not.toContain('Parent Product Plan reconciliation required');
  });

  it('does not reconcile a child ticket before its file exists', () => {
    rmSync(childTicket);
    const result = spawnSync('bun', [preTool], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: {
          file_path: childTicket,
          content:
            '---\nid: CHILD1\ntype: feature\nphase: intake\nstatus: in_progress\nproduct_plan_contract: v1\nparent: EPIC01\nparent_job: parent.PLO1\nmilestone: M1\n---\n',
        },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    });
    expect(result.stdout).not.toContain('Parent Product Plan reconciliation required');
  });

  it('blocks a phase change that removes activation while leaving partial references', () => {
    const prior = readFileSync(childTicket, 'utf8');
    const content = prior
      .replace('phase: intake', 'phase: define-behavior')
      .replace('product_plan_contract: v1\n', '')
      .replace('parent_job: parent.PLO1\n', '');
    const result = spawnSync('bun', [preTool], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: childTicket, content },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    });
    expect(result.stdout).toContain('parent, parent_job, and milestone must be declared together');
  });

  it('allows a reconciled parent contract and rejects its later drift', () => {
    const digest = resolveParentContract(project, 'EPIC01', 'parent.PLO1', 'M1').digest;
    writeFileSync(
      childTicket,
      readFileSync(childTicket, 'utf8')
        .split('milestone: M1')
        .join(`milestone: M1\nparent_contract_digest: ${digest}`),
    );
    const edit = {
      tool_name: 'Edit',
      tool_input: {
        file_path: childTicket,
        old_string: 'phase: intake',
        new_string: 'phase: define-behavior',
      },
    };
    const allowed = spawnSync('bun', [preTool], {
      input: JSON.stringify(edit),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    });
    expect(allowed.stdout).not.toContain('Parent Product Plan reconciliation required');

    const parentSpec = nodePath.join(project, '.project/tickets/EPIC01-parent/spec.md');
    writeFileSync(
      parentSpec,
      readFileSync(parentSpec, 'utf8').replace('Outcome:** value', 'Outcome:** changed'),
    );
    const denied = spawnSync('bun', [preTool], {
      input: JSON.stringify(edit),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    });
    expect(denied.stdout).toContain('the referenced parent Product Plan changed');
  });

  it('blocks completion when the parent digest is missing', () => {
    writeFileSync(childTicket, readDoneTicket());
    const transcript = nodePath.join(project, 'transcript.jsonl');
    writeFileSync(
      transcript,
      `${JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [] } })}\n`,
    );
    writeFileSync(
      nodePath.join(project, '.project/quality-state-session.json'),
      JSON.stringify({ activeTicket: 'CHILD1' }),
    );
    const result = spawnSync('bun', [stop], {
      input: JSON.stringify({ transcript_path: transcript, session_id: 'session' }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    });
    expect(result.stdout).toContain('has not been reconciled');
    expect(result.stdout).toContain('--accept');
  });

  function readDoneTicket(): string {
    return '---\nid: CHILD1\ntype: feature\nphase: done\nstatus: in_progress\nproduct_plan_contract: v1\nparent: EPIC01\nparent_job: parent.PLO1\nmilestone: M1\n---\n';
  }
});
