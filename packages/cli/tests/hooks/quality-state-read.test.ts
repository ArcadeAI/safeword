/**
 * Unit tests for readSessionState — the shared per-session quality-state reader.
 *
 * Read-only hooks (stop-reentry, pre-tool, session-compact, stop-quality readers)
 * rely on this returning the parsed state or `null` (absent / unreadable /
 * unparseable) without throwing.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readSessionState } from '../../../../.safeword/hooks/lib/quality-state';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context = { projectDirectory: '' };

beforeEach(() => {
  context.projectDirectory = createTemporaryDirectory();
  // resolveNamespaceRoot defaults to .project/ when neither namespace dir exists.
  mkdirSync(nodePath.join(context.projectDirectory, '.project'), { recursive: true });
});

afterEach(() => {
  removeTemporaryDirectory(context.projectDirectory);
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
});
