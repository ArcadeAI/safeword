import { describe, expect, it } from 'vitest';

import { publicFixtureEnvironment } from '../../features/steps/public-fixture-environment.js';

describe('public CLI BDD fixture environment', () => {
  it('replaces an inherited Codex profile with fixture-scoped state', () => {
    const environment = publicFixtureEnvironment(
      '/tmp/safeword-cli-bdd-fixture',
      { SAFEWORD_NO_UPDATE_CHECK: '1' },
      { CODEX_HOME: '/Users/developer/.codex', NODE_OPTIONS: '--inspect' },
    );

    expect(environment).toMatchObject({
      CODEX_HOME: '/tmp/safeword-cli-bdd-fixture/codex-profile',
      SAFEWORD_NO_UPDATE_CHECK: '1',
      SAFEWORD_SKIP_INSTALL: '1',
    });
    expect(environment.NODE_OPTIONS).toBeUndefined();
  });
});
