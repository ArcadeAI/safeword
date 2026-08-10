import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/commands/retro.js', () => ({
  executeRetroCommand: vi.fn(() => Promise.reject(new Error('controlled extractor failure'))),
}));

import { publicHandler } from '../../src/cli-protocol/public-handlers.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

describe('retro run failure envelope', () => {
  it('converts an unexpected collaborator exception into the typed public result', async () => {
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
});
