import { describe, expect, it } from 'vitest';

import { reviewRoutePlan } from '../../src/review/policy.js';

describe('review route policy', () => {
  it('keeps preferred pairs and adds one independent OpenCode fallback', () => {
    expect(reviewRoutePlan('claude')).toEqual({
      author: 'claude',
      preferred: 'codex',
      independentFallback: 'opencode',
      degradedFallback: 'claude',
    });
    expect(reviewRoutePlan('codex')).toEqual({
      author: 'codex',
      preferred: 'claude',
      independentFallback: 'opencode',
      degradedFallback: 'codex',
    });
    expect(reviewRoutePlan('opencode')).toEqual({
      author: 'opencode',
      preferred: 'claude',
      independentFallback: 'codex',
      degradedFallback: 'opencode',
    });
  });

  it.each(['cursor', 'unknown'])('keeps unsupported author %s outside review routing', author => {
    expect(reviewRoutePlan(author)).toBeUndefined();
  });
});
