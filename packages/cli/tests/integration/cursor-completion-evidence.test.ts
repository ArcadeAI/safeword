import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getStateFilePath } from '../../templates/hooks/lib/quality-state.js';
import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  sourceHookEnvironment,
} from '../helpers.js';

const cliRoot = nodePath.resolve(import.meta.dirname, '../..');
const conversation = 'completion-evidence-test';

describe('Cursor completion evidence at the real adapter process', () => {
  let directory: string;
  let ticket: string;

  beforeEach(() => {
    directory = createTemporaryDirectory();
    ticket = nodePath.join(directory, '.project/tickets/UNFNSH-work');
    mkdirSync(ticket, { recursive: true });
    mkdirSync(nodePath.join(directory, '.safeword'));
    writeFileSync(
      nodePath.join(directory, '.safeword/config.json'),
      JSON.stringify({
        terminalHandoffCorrection: false,
        selfReport: { capture: false, surface: false, file: false },
      }),
    );
    writeFileSync(
      nodePath.join(ticket, 'ticket.md'),
      '---\nid: UNFNSH\ntype: task\nstatus: in_progress\nphase: done\n---\n',
    );
    const identity = resolveRunIdentity({ conversation_id: conversation }, { runtime: 'cursor' });
    writeFileSync(
      getStateFilePath(directory, identity),
      JSON.stringify({ activeTicket: 'UNFNSH' }),
    );
  });

  afterEach(() => {
    removeTemporaryDirectory(directory);
  });

  it('continues completion with the shared verification requirement even without edits', () => {
    const result = spawnSync('bun', [nodePath.join(cliRoot, 'templates/hooks/cursor/stop.ts')], {
      cwd: directory,
      input: JSON.stringify({
        workspace_roots: [directory],
        conversation_id: conversation,
        status: 'completed',
        loop_count: 0,
      }),
      encoding: 'utf8',
      env: { ...sourceHookEnvironment(directory), SAFEWORD_AGENT_RUNTIME: 'cursor' },
      timeout: 30_000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).followup_message).toContain('No valid verify.md');
  });
});
