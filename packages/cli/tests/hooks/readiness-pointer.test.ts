import { describe, expect, it } from 'vitest';

import {
  READINESS_POINTER,
  shouldSurfaceReadiness,
} from '../../../../.safeword/hooks/lib/readiness-pointer';

describe('readiness pointer (TPP6Y2)', () => {
  it('surfaces the readiness pointer when there is no active ticket (pre-classify)', () => {
    expect(shouldSurfaceReadiness(undefined)).toBe(true);
    expect(READINESS_POINTER.trim().length).toBeGreaterThan(0);
  });
});
