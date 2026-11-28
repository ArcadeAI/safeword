import { readFileSync } from 'node:fs';

import { describe, it } from 'vitest';

import { proveOpenCodeCoexistence } from '../helpers/opencode-native-coexistence.js';
import type { OpenCodeNativeFixture } from '../helpers/opencode-native-write.js';

const config = process.env.SAFEWORD_OPENCODE_TEST_CONFIG;
/* eslint-disable vitest/expect-expect -- the shared actor asserts actual native host outcomes */
describe.runIf(Boolean(config))('OpenCode profile coexistence', () => {
  it.each(['CLI', 'TUI'] as const)(
    'retains independent V1/V2 %s authority',
    async runtime => {
      if (!config) throw new Error('SAFEWORD_OPENCODE_TEST_CONFIG required');
      const fixture = JSON.parse(readFileSync(config, 'utf8')) as OpenCodeNativeFixture;
      await proveOpenCodeCoexistence(fixture, runtime);
    },
    300_000,
  );
});
/* eslint-enable vitest/expect-expect */
