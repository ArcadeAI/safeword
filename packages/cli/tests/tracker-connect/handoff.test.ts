import { describe, expect, it } from 'vitest';

import { handoffSteps } from '../../src/tracker-connect/handoff.js';

/** Per-provider human-handoff steps (2TK5AD AC2) — pure text, no I/O. */
describe('tracker-connect handoff steps', () => {
  it('github names the App install, the PAT fallback, and the target repo', () => {
    const text = handoffSteps('github', { repo: 'acme/demo' }).join('\n');
    expect(text).toMatch(/App/);
    expect(text).toMatch(/PAT|personal access token/i);
    expect(text).toContain('acme/demo');
  });

  it('linear names the Arcade authorize step', () => {
    const text = handoffSteps('linear', { team: 'ENG' }).join('\n');
    expect(text).toMatch(/Arcade/i);
    expect(text).toMatch(/authorize/i);
  });
});
