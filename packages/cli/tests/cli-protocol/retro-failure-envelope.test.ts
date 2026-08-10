import { beforeEach, describe, expect, it, vi } from 'vitest';

const retro = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('../../src/commands/retro.js', () => ({
  executeRetroCommand: retro.execute,
}));

import { publicHandler } from '../../src/cli-protocol/public-handlers.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

describe('retro run failure envelope', () => {
  beforeEach(() => {
    retro.execute.mockReset();
  });

  it('converts an unexpected collaborator exception into the typed public result', async () => {
    retro.execute.mockRejectedValue(new Error('controlled extractor failure'));
    const directory = createTemporaryDirectory();
    let result;
    try {
      result = await publicHandler('retro run')({
        cwd: directory,
        noInput: true,
        offline: false,
        options: { transcript: 'session.jsonl' },
        operands: [],
      });
    } finally {
      removeTemporaryDirectory(directory);
    }

    expect(result).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [
        {
          code: 'RETRO_COMMAND_FAILED',
          message: 'controlled extractor failure',
          retryable: true,
        },
      ],
    });
  });

  it('preserves partial mutation evidence when a collaborator reports failure', async () => {
    retro.execute.mockImplementation((_options: unknown, directory: string) => {
      const spool = nodePath.join(directory, '.safeword/retro-drafts/partial-session.jsonl');
      mkdirSync(nodePath.dirname(spool), { recursive: true });
      writeFileSync(spool, '{"partial":true}\n');
      return Promise.resolve({
        extractionSucceeded: true,
        restTransportAvailable: true,
        outcome: {
          ok: false,
          errorMessage: 'one finding could not be filed',
          agentFilingNeeded: true,
          result: {
            bumped: [],
            commented: [],
            created: [{ number: 42 }],
            deferred: [],
            failed: ['broken finding'],
            filedDestinations: [],
            filedSignatures: [],
          },
        },
      });
    });
    const directory = createTemporaryDirectory();
    let result;
    try {
      result = await publicHandler('retro run')({
        cwd: directory,
        noInput: true,
        offline: false,
        options: { transcript: 'session.jsonl', sessionId: 'partial-session' },
        operands: [],
      });
    } finally {
      removeTemporaryDirectory(directory);
    }

    expect(result).toMatchObject({
      state: 'failed',
      changed: true,
      effects: {
        files: [{ kind: 'create', target: '.safeword/retro-drafts/partial-session.jsonl' }],
        network: [{ kind: 'retro-triage', target: 'GitHub' }],
      },
      errors: [{ code: 'RETRO_COMMAND_FAILED', message: 'one finding could not be filed' }],
      data: {
        command: 'retro run',
        agent_filing_needed: true,
        result: { created: [{ number: 42 }], failed: ['broken finding'] },
      },
    });
  });
});
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
