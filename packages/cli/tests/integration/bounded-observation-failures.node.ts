/* eslint-disable vitest/no-import-node-test -- A Node parent avoids nesting the observed Vitest lane. */

import { test } from 'node:test';

import { runObserverCli } from '../fixtures/bounded-observation.js';
import {
  createRequiredOutcomeCandidate,
  expectNamedRequiredRecovery,
} from '../fixtures/bounded-observation-failures.js';

for (const outcome of ['absent', 'skipped', 'failed'] as const) {
  void test(`required assertion ${outcome} retains named recovery`, { timeout: 240_000 }, () => {
    const candidate = createRequiredOutcomeCandidate(outcome);
    try {
      expectNamedRequiredRecovery(
        candidate,
        runObserverCli(candidate, ['proof', 'observe-bounded-delivery']),
      );
    } finally {
      candidate.dispose();
    }
  });
}
