/**
 * Integration test: the Claude Stop filing gate (issue #628 / ticket GH628F).
 *
 * When earlier async extraction spooled unfiled drafts, Stop emits the sanctioned
 * continuation ({decision:"block"}) whose reason dispatches the
 * safeword-retro-filer subagent with the spool path — attempt-capped per batch,
 * honoring stop_hook_active and the selfReport.file off-switch. Decision logic is
 * unit-tested in tests/hooks/retro-filing-gate; this proves the hook wiring.
 */

import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { markDraftsFiled, spoolDrafts } from '../../templates/hooks/lib/retro-draft-spool.js';
import {
  FILER_AGENT_NAME,
  FILING_ATTEMPT_CAP,
} from '../../templates/hooks/lib/retro-filing-gate.js';
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  retroDraft as draft,
  TIMEOUT_QUICK,
  writeSelfReportConfig as writeConfig,
} from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HOOK = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-retro-filing.ts');

function runHook(directory: string, input: unknown) {
  return spawnSync('bun', [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('stop-retro-filing hook (GH628F — sanctioned dispatch continuation)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });
  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('blocks the stop with the filer dispatch when unfiled drafts exist', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa', 'Alpha')]);
    const result = runHook(projectDirectory, { session_id: 'sess-1', stop_hook_active: false });
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.decision).toBe('block');
    expect(out.reason).toContain(FILER_AGENT_NAME);
    expect(out.reason).toContain('.safeword/retro-drafts');
  });

  it('stays silent when the stop is already a hook continuation (stop_hook_active)', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa', 'Alpha')]);
    const result = runHook(projectDirectory, { session_id: 'sess-1', stop_hook_active: true });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('stays silent when selfReport.file is off', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa', 'Alpha')]);
    writeConfig(projectDirectory, { file: false });
    const result = runHook(projectDirectory, { session_id: 'sess-1' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('stays silent when the spool is drained (the ack) and without a session id', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa', 'Alpha')]);
    markDraftsFiled(projectDirectory, 'sess-1', ['retro:aaaaaaaaaaaa']);
    expect(runHook(projectDirectory, { session_id: 'sess-1' }).stdout.trim()).toBe('');
    expect(runHook(projectDirectory, {}).stdout.trim()).toBe('');
  });

  it('resolves the session id from the env when the payload omits it (spool-writer parity)', () => {
    // Cloud extraction keys the spool via CLAUDE_CODE_REMOTE_SESSION_ID when the
    // payload lacks session_id; the gate must find the SAME spool or it silently
    // never fires (quality-review pass-1, improvement 2).
    spoolDrafts(projectDirectory, 'cloud-sess', [draft('retro:aaaaaaaaaaaa', 'Alpha')]);
    const result = spawnSync('bun', [HOOK], {
      input: JSON.stringify({}),
      cwd: projectDirectory,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectDirectory,
        CLAUDE_CODE_REMOTE_SESSION_ID: 'cloud-sess',
        CLAUDE_SESSION_ID: '',
      },
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.decision).toBe('block');
    expect(out.reason).toContain(FILER_AGENT_NAME);
  });

  it(`goes quiet after ${FILING_ATTEMPT_CAP} attempts on the same undrained batch`, () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa', 'Alpha')]);
    for (let attempt = 1; attempt <= FILING_ATTEMPT_CAP; attempt++) {
      expect(runHook(projectDirectory, { session_id: 'sess-1' }).stdout).toContain('block');
    }
    expect(runHook(projectDirectory, { session_id: 'sess-1' }).stdout.trim()).toBe('');
  });
});
