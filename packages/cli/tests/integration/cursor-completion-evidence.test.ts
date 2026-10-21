import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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

  function run(overrides: Record<string, unknown> = {}): { followup_message?: string } {
    const result = spawnSync('bun', [nodePath.join(cliRoot, 'templates/hooks/cursor/stop.ts')], {
      cwd: directory,
      input: JSON.stringify({
        workspace_roots: [directory],
        conversation_id: conversation,
        status: 'completed',
        loop_count: 0,
        ...overrides,
      }),
      encoding: 'utf8',
      env: { ...sourceHookEnvironment(directory), SAFEWORD_AGENT_RUNTIME: 'cursor' },
      timeout: 30_000,
    });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout) as { followup_message?: string };
  }

  it('continues completion with the shared verification requirement even without edits', () => {
    expect(run().followup_message).toContain('No valid verify.md');
    expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toContain(
      'status: in_progress',
    );
  });

  it('allows completion when the shared evidence checks pass', () => {
    writeFileSync(
      nodePath.join(ticket, 'verify.md'),
      '**PR Scope:** ✅ Diff matches ticket scope\n',
    );
    const original = readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8');
    expect(run()).toEqual({});
    expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toBe(original);
  });

  it('keeps ordinary verification work quiet', () => {
    const file = nodePath.join(ticket, 'ticket.md');
    writeFileSync(file, readFileSync(file, 'utf8').replace('phase: done', 'phase: verify'));
    expect(run()).toEqual({});
  });

  it.each(['another-conversation', undefined])(
    'does not adopt another session ticket for %s',
    id => {
      expect(run({ conversation_id: id })).toEqual({});
    },
  );

  it.each(['aborted', 'error'])('never continues a %s host stop', status => {
    expect(run({ status })).toEqual({});
  });

  it('resolves completion evidence from the configured project namespace', () => {
    const file = nodePath.join(directory, '.safeword/config.json');
    const config = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    writeFileSync(file, JSON.stringify({ ...config, paths: { projectRoot: '.work' } }));
    renameSync(nodePath.join(directory, '.project'), nodePath.join(directory, '.work'));
    expect(run().followup_message).toContain('No valid verify.md');
  });

  it('retains unmet evidence in a later host loop', () => {
    expect(run({ loop_count: 1 }).followup_message).toContain('No valid verify.md');
  });
});
