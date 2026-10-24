/* eslint-disable vitest/no-import-node-test -- This probe exercises a distribution preflight outside Vitest. */

import { test } from 'node:test';

import {
  createUnmappedDistribution,
  expectNamedUnmappedCase,
  runUnmappedDistribution,
} from '../fixtures/bounded-observation-profile.js';

void test('unmapped shipped case is named before execution', { timeout: 120_000 }, () => {
  const distribution = createUnmappedDistribution();
  try {
    expectNamedUnmappedCase(distribution, runUnmappedDistribution(distribution));
  } finally {
    distribution.candidate.dispose();
  }
});
