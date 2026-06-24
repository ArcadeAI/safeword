/**
 * Unit tests for readSessionState — the shared per-session quality-state reader.
 *
 * Read-only hooks (stop-reentry, pre-tool, session-compact, stop-quality readers)
 * rely on this returning the parsed state or `null` (absent / unreadable /
 * unparseable) without throwing.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getStateFilePath,
  readSessionState,
  recordFailure,
} from '../../templates/hooks/lib/quality-state.js';
import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context = { projectDirectory: '' };
const originalRuntime = process.env.SAFEWORD_AGENT_RUNTIME;

beforeEach(() => {
  delete process.env.SAFEWORD_AGENT_RUNTIME;
  context.projectDirectory = createTemporaryDirectory();
  // resolveNamespaceRoot defaults to .project/ when neither namespace dir exists.
  mkdirSync(nodePath.join(context.projectDirectory, '.project'), { recursive: true });
});

afterEach(() => {
  removeTemporaryDirectory(context.projectDirectory);
  if (originalRuntime === undefined) {
    delete process.env.SAFEWORD_AGENT_RUNTIME;
  } else {
    process.env.SAFEWORD_AGENT_RUNTIME = originalRuntime;
  }
});

const stateFile = (sessionId: string): string =>
  nodePath.join(context.projectDirectory, '.project', `quality-state-${sessionId}.json`);

describe('readSessionState', () => {
  it('returns the parsed state when the per-session file exists', () => {
    writeFileSync(stateFile('s1'), JSON.stringify({ activeTicket: 'ABC123' }));

    const state = readSessionState(context.projectDirectory, 's1');

    expect(state?.activeTicket).toBe('ABC123');
  });

  it('returns null when no per-session state file exists', () => {
    expect(readSessionState(context.projectDirectory, 'missing')).toBeNull();
  });

  it('returns null (no throw) when the state file is malformed JSON', () => {
    writeFileSync(stateFile('s2'), '{ not valid json');

    expect(() => readSessionState(context.projectDirectory, 's2')).not.toThrow();
    expect(readSessionState(context.projectDirectory, 's2')).toBeNull();
  });

  it('records Codex state in a runtime-scoped file without overwriting legacy Claude state', () => {
    const baseState = {
      locSinceCommit: 0,
      lastCommitHash: '',
      recentFailures: [],
      incrementedPatterns: [],
    };
    const legacyClaudePath = stateFile('same-session');
    writeFileSync(
      legacyClaudePath,
      JSON.stringify({ ...baseState, activeTicket: 'CLAUDE-TICKET' }),
    );

    const codexIdentity = resolveRunIdentity(
      { session_id: 'same-session', turn_id: 'turn-1' },
      { runtime: 'codex', env: {} },
    );
    const codexPath = getStateFilePath(context.projectDirectory, codexIdentity);
    writeFileSync(codexPath, JSON.stringify(baseState));

    recordFailure(context.projectDirectory, codexIdentity, 'loc-exceeded');

    expect(codexPath).toContain('quality-state-codex-same-session.json');
    expect(JSON.parse(readFileSync(legacyClaudePath, 'utf8')).activeTicket).toBe('CLAUDE-TICKET');
    expect(JSON.parse(readFileSync(codexPath, 'utf8')).recentFailures).toEqual([
      expect.objectContaining({ pattern: 'loc-exceeded' }),
    ]);
  });
});
