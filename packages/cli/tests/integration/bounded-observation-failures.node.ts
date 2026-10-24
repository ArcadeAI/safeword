/* eslint-disable vitest/no-import-node-test -- A Node parent avoids nesting the observed Vitest lane. */

import { test } from 'node:test';

import { runObserverCli } from '../fixtures/bounded-observation.js';
import {
  createRequiredOutcomeCandidate,
  expectNamedRequiredRecovery,
} from '../fixtures/bounded-observation-failures.js';

void test('required assertion outcomes retain named recovery', { timeout: 900_000 }, () => {
  for (const outcome of ['absent', 'skipped', 'failed'] as const) {
    const candidate = createRequiredOutcomeCandidate(outcome);
    try {
      expectNamedRequiredRecovery(
        candidate,
        runObserverCli(candidate, ['proof', 'observe-bounded-delivery']),
      );
    } finally {
      candidate.dispose();
    }
  }
});
