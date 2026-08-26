import { describe, expect, it } from 'vitest';

import { proveOpenCodeHostContract } from '../helpers/opencode-host-contract.js';

describe('OpenCode 1.18.23 host contract', () => {
  it('discovers native catalogue surfaces and awaits a blocking pre-tool dispatcher', async () => {
    const evidence = await proveOpenCodeHostContract();

    expect(evidence).toEqual({
      version: '1.18.23',
      discovered: ['command', 'agent', 'skill'],
      preToolInputKeys: {
        bash: 'command',
        shell: 'command',
        edit: 'filePath',
        write: 'filePath',
        patch: 'patchText',
      },
      dispatcher: {
        exitCode: 2,
        stdout: 'fixture-denied',
        awaitedBeforeDenial: true,
      },
      denialSentinelExists: false,
    });
  }, 120_000);
});
