import { expect, it } from 'vitest';

import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';
import { runCliWithLiteralArguments } from '../helpers.js';
import { electronAuthorizationFixture } from './legacy-electron-authorization.fixture.js';

it.runIf(process.platform !== 'win32')(
  'refuses closing before every enrolled historical row has separate verified credit',
  async () => {
    const fixture = await electronAuthorizationFixture();
    try {
      const result = await runCliWithLiteralArguments(
        [
          '--cwd',
          fixture.root,
          '--json',
          '--no-input',
          'review',
          'attest',
          'retrospective-close',
          '--ticket',
          policy.ticketId,
          '--ledger',
          policy.ledger,
        ],
        { cwd: fixture.root, env: fixture.environment },
      );
      expect(result.exitCode).not.toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.data).toMatchObject({
        command: 'review attest retrospective-close',
        status: 'blocked',
        ticketId: policy.ticketId,
        ledger: policy.ledger,
      });
      expect(payload.findings[0]?.message).toContain('Missing required Electron VERIFIED row');
      expect(fixture.events().filter(event => event.event === 'test')).toHaveLength(2);
    } finally {
      fixture.cleanup();
    }
  },
);
