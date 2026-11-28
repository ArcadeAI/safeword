import { expect, it } from 'vitest';

import { runResourcePropagation } from '../../scripts/lib/resource-propagation.js';
import { observedCatalogueMarkers } from '../helpers/native-catalogue-probe.js';

it('ignores partial streamed tokens without choosing an expected marker', () => {
  const nonce = '7ec52dc1-88c6-4b18-8803-d829a11e2ddf';
  const output = [
    JSON.stringify({ type: 'thinking', subtype: 'delta', text: 'GUIDE_7e' }),
    JSON.stringify({ text: `WORKFLOW_${nonce} GUIDE_${nonce} HELPER_${nonce}` }),
  ].join('\n');
  expect(observedCatalogueMarkers(output)).toEqual({
    workflowMarker: `WORKFLOW_${nonce}`,
    guideMarker: `GUIDE_${nonce}`,
    helperMarker: `HELPER_${nonce}`,
  });
});

it('extracts actual returned markers without an expected-input argument', () => {
  expect(
    observedCatalogueMarkers(
      'WORKFLOW_11111111-1111-4111-8111-111111111111 GUIDE_22222222-2222-4222-8222-222222222222 HELPER_33333333-3333-4333-8333-333333333333',
    ),
  ).toEqual({
    workflowMarker: 'WORKFLOW_11111111-1111-4111-8111-111111111111',
    guideMarker: 'GUIDE_22222222-2222-4222-8222-222222222222',
    helperMarker: 'HELPER_33333333-3333-4333-8333-333333333333',
  });
});
it.each(['json', 'jsonl'])('extracts line-leading native markers from %s output', format => {
  const row = JSON.stringify({
    output:
      '\nWORKFLOW_11111111-1111-4111-8111-111111111111\nGUIDE_22222222-2222-4222-8222-222222222222\nHELPER_33333333-3333-4333-8333-333333333333',
  });
  const raw = format === 'jsonl' ? `${row}\n${JSON.stringify({ type: 'turn.completed' })}` : row;
  expect(observedCatalogueMarkers(raw), 'SERIALIZED_NATIVE_MARKER_DROPPED').toEqual({
    workflowMarker: 'WORKFLOW_11111111-1111-4111-8111-111111111111',
    guideMarker: 'GUIDE_22222222-2222-4222-8222-222222222222',
    helperMarker: 'HELPER_33333333-3333-4333-8333-333333333333',
  });
});
it.each(['', 'WORKFLOW_abc WORKFLOW_def GUIDE_abc HELPER_abc'])(
  'rejects missing or conflicting raw observations: %s',
  output => {
    expect(() => observedCatalogueMarkers(output)).toThrow(
      'PROPAGATION_MARKER_AMBIGUOUS_OR_MISSING',
    );
  },
);

it('rejects two distinct complete tokens even with streamed prefixes present', () => {
  const first = '11111111-1111-4111-8111-111111111111';
  const second = '22222222-2222-4222-8222-222222222222';
  expect(() =>
    observedCatalogueMarkers(
      `GUIDE_11 WORKFLOW_${first} GUIDE_${first} GUIDE_${second} HELPER_${first}`,
    ),
  ).toThrow('PROPAGATION_MARKER_AMBIGUOUS_OR_MISSING:GUIDE');
});

it('rejects an incomplete token when no complete observation follows', () => {
  const nonce = '11111111-1111-4111-8111-111111111111';
  expect(() => observedCatalogueMarkers(`WORKFLOW_${nonce} GUIDE_7e HELPER_${nonce}`)).toThrow(
    'PROPAGATION_MARKER_AMBIGUOUS_OR_MISSING:GUIDE',
  );
});

it('rejects actual stale output even when the actor was given current canonical inputs', async () => {
  const inputs = {
    canonicalRoot: '/unused',
    workflowMarker: 'WORKFLOW_NEW',
    guideMarker: 'GUIDE_NEW',
    helperMarker: 'HELPER_NEW',
  };
  await expect(
    runResourcePropagation(inputs, inputs, lane =>
      Promise.resolve({
        refreshResources: () => Promise.resolve(),
        observe: () =>
          Promise.resolve({
            installation: lane.id,
            raw: 'synthetic source control',
            delivery: lane.delivery,
            markers: { ...inputs, workflowMarker: 'WORKFLOW_OLD' },
          }),
      }),
    ),
  ).rejects.toThrow('PROPAGATION_RESOURCE_STALE');
});
