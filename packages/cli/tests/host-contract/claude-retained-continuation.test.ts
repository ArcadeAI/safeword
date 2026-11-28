import { expect, it } from 'vitest';

import { prepareClaudeRetainedFixture, previousHelperMarker } from './claude-retained-fixture.js';

it('prepares a real retained Claude configured session', async () => {
  const fixture = await prepareClaudeRetainedFixture();
  try {
    const earlier = JSON.parse(fixture.prior.raw).observations;
    expect(earlier.length).toBeGreaterThan(0);
    expect(earlier[0].input.session_id).toBeTruthy();
    expect(fixture.prior.installation).toContain(fixture.runtimePath);
  } finally {
    fixture.close();
  }
}, 120_000);

it('retains prior hook output as evidence while extracting only current catalogue markers', async () => {
  const fixture = await prepareClaudeRetainedFixture();
  try {
    const observation = await fixture.actor.observe();
    const { workflowMarker, guideMarker, helperMarker } = fixture.inputs;
    expect(observation.markers).toEqual({ workflowMarker, guideMarker, helperMarker });
    expect(observation.raw).toContain(previousHelperMarker);
    expect(observation.raw).toContain(helperMarker);
  } finally {
    fixture.close();
  }
}, 120_000);
