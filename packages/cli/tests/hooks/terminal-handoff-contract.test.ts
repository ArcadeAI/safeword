import { describe, expect, it } from 'vitest';

import * as quality from '../../templates/hooks/lib/quality.js';

describe('terminal handoff contract', () => {
  it('accepts one self-contained Next decision under the versioned contract', () => {
    const reply = [
      'The implementation and focused tests are complete. Production rollout remains intentionally separate.',
      '**CONFIDENT** — The implementation is ready, but the release target needs a human choice.',
      '**Decided:** Keep the release scoped to one channel.',
      '**Open:** human: choose the release channel.',
      '**Next:** Choice: release to the beta channel or the stable channel. Recommendation: choose beta. Reason: beta limits exposure while we verify production telemetry. Impact: beta delays the stable release by one day; stable reaches everyone immediately with more rollback risk. Reply: `beta` or `stable`.',
    ].join('\n\n');

    const evaluation = quality.evaluateDecisionBriefCompliance(reply) as ReturnType<
      typeof quality.evaluateDecisionBriefCompliance
    > & { contractVersion?: string; form?: string };

    expect(evaluation).toEqual({
      compliant: true,
      contractVersion: 'terminal-handoff/v1',
      form: 'decision',
      examinedCharacters: expect.any(Number),
    });
  });
});
