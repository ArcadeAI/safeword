import { describe, expect, it } from 'vitest';

import {
  type LocalRetroReadinessManifest,
  validateLocalRetroReadiness,
} from './local-retro-readiness.js';

const evidenceCommit = 'a'.repeat(40);
const fabricatedEvidence = {
  ancestorPairs: [{ ancestor: evidenceCommit, descendant: 'b'.repeat(40) }],
  buildCommit: 'b'.repeat(40),
  now: new Date('2026-08-29T01:00:00.000Z'),
  relayReady: true,
};

const fabricatedManifest = {
  enabled: true,
  evidenceCommit,
  harnesses: {},
  recoveredFaults: {},
  reviewedAt: '2026-08-29T00:00:00.000Z',
  version: 1,
} as LocalRetroReadinessManifest;

describe('local retro readiness', () => {
  it('rejects a locally fabricated enabled manifest while production authority is unavailable', () => {
    expect(validateLocalRetroReadiness(fabricatedManifest, fabricatedEvidence)).toBe(false);
  });

  it('rejects the checked-in disabled state', () => {
    expect(validateLocalRetroReadiness({ enabled: false, version: 1 }, fabricatedEvidence)).toBe(
      false,
    );
  });
});
