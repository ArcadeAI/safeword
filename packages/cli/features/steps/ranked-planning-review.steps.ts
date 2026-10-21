import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  type RankedCase,
  rankedPlanningReview,
} from '../../tests/fixtures/ranked-planning-review.js';
import { createTrustedReviewerDirectory } from '../../tests/review-fixtures.js';
import type { SafewordWorld } from './world.js';

interface RankedState {
  project: string;
  bin: string;
  example: RankedCase;
  result?: Awaited<ReturnType<typeof rankedPlanningReview>>;
}
const states = new WeakMap<SafewordWorld, RankedState>();
function state(world: SafewordWorld): RankedState {
  const current = states.get(world);
  assert.ok(current, 'ranked planning fixture must exist');
  return current;
}
Given(
  'a ranked planning review with {string} routes',
  function (this: SafewordWorld, example: RankedCase) {
    assert.ok(['first', 'alternate', 'later', 'unsupported'].includes(example));
    const prefix = nodePath.join(tmpdir(), 'safeword-ranked-');
    states.set(this, {
      project: mkdtempSync(prefix),
      bin: createTrustedReviewerDirectory('safeword-ranked-bin-'),
      example,
    });
  },
);
When(
  'the real planning review CLI runs',
  { timeout: 40_000 },
  async function (this: SafewordWorld) {
    const current = state(this);
    current.result = await rankedPlanningReview(current.project, current.bin, current.example);
  },
);
Then(
  'reviewer processes launch exactly in this order: {string}',
  function (this: SafewordWorld, expected: string) {
    const result = state(this).result;
    assert.ok(result);
    assert.deepEqual(
      result.launches.map(({ agent, model }) => `${agent}:${model}`),
      expected.split(','),
    );
  },
);
Then(
  'the completed planning review names {string} with {string} assurance',
  function (this: SafewordWorld, reviewer: string, assurance: string) {
    const data = state(this).result?.output.data;
    assert.equal(data?.status, 'approved');
    assert.equal(data.actual_reviewer, reviewer);
    assert.equal(data.independence, assurance);
  },
);
Then(
  '{int} reviewer packets retain the complete target and the same sealed dispatch',
  function (this: SafewordWorld, count: number) {
    const packets = state(this)
      .result?.launches.filter(launch => launch.packet !== undefined)
      .map(launch => launch.packet);
    assert.ok(packets);
    assert.equal(packets.length, count);
    const target = '.project/tickets/RNK123-ranked/impl-plan.md';
    const content = readFileSync(nodePath.join(state(this).project, target), 'utf8');
    for (const packet of packets)
      assert.deepEqual(packet.logical_files, [{ path: target, content }]);
    for (const packet of packets) assert.deepEqual(packet, packets[0]);
    assert.ok(packets[0].dispatch_id);
  },
);
After(function (this: SafewordWorld) {
  const current = states.get(this);
  if (current) {
    rmSync(current.project, { recursive: true, force: true });
    rmSync(current.bin, { recursive: true, force: true });
  }
});
