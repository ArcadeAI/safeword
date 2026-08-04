import { describe, expect, it } from 'vitest';

import { createVerifyClient } from '../../src/tracker-connect/verify.js';

describe('tracker-connect live verification', () => {
  it('explains that Linear verification is not wired yet', async () => {
    const result = await createVerifyClient().whoami('linear');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected Linear verification to be unavailable');
    expect(result.missing).toMatch(/Arcade integration.*not wired yet/i);
  });
});
