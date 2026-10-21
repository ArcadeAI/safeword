import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { describe, it } from 'vitest';

import {
  type CodexGuardFixture,
  CodexNativeContinuationActor,
} from '../helpers/codex-native-continuation.js';
import { CodexNativeWriteActor } from '../helpers/codex-native-write.js';

function fixture(): CodexGuardFixture {
  const path = process.env.SAFEWORD_CODEX_GUARD_FIXTURE;
  assert.ok(path, 'HOST_CONTRACT_PROOF_UNAVAILABLE: SAFEWORD_CODEX_GUARD_FIXTURE is required');
  return JSON.parse(readFileSync(path, 'utf8')) as CodexGuardFixture;
}
// Assertions live in the shared actors exercised by the actual feature rows too.
/* eslint-disable vitest/expect-expect -- shared actors assert real native outcomes */
describe.runIf(Boolean(process.env.SAFEWORD_CODEX_GUARD_FIXTURE))(
  'native Codex compatibility guard baseline',
  () => {
    it.each(['allowed', 'denied'] as const)(
      'codex-0.160.0-%s-write',
      async disposition => {
        const actor = new CodexNativeWriteActor(fixture());
        await actor.prepare('Codex', '0.160.0', 'CLI');
        actor.setPolicy(disposition);
        await actor.attempt();
        actor.assertOutcome();
      },
      300_000,
    );
    it('codex-0.160.0-bounded-continuation', async () => {
      const actor = new CodexNativeContinuationActor(fixture());
      await actor.prepareContinuation('Codex', '0.160.0');
      actor.setMissingVerification();
      await actor.attemptCompletion();
      actor.assertContinuation();
    }, 420_000);
  },
);
/* eslint-enable vitest/expect-expect */
