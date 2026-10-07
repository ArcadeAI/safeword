import { describe, expect, it, vi } from 'vitest';

import { requestBrowserOpen } from '../../src/codex-plugin/reviewer-browser.js';

vi.mock('node:child_process', () => ({
  spawn: () => {
    throw Object.assign(new Error('OS policy denied the browser opener'), { code: 'EPERM' });
  },
}));

describe('reviewer sign-in fallback after an immediate opener failure', () => {
  it('reports that the opener did not start so the sign-in link remains available', async () => {
    await expect(requestBrowserOpen('https://auth.openai.com/codex/device')).resolves.toBe(false);
  });
});
