import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
