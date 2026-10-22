import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BeforeAll } from '@cucumber/cucumber';

import {
  type OpenCodeNativeFixture,
  OpenCodeNativeWriteActor,
} from '../../helpers/opencode-native-write.js';

// Imported only by the OpenCode guard component. Other hosts are never probed.
BeforeAll({ timeout: 600_000 }, async () => {
  const file = process.env.SAFEWORD_OPENCODE_TEST_CONFIG;
  assert.ok(file, 'HOST_CONTRACT_PROOF_UNAVAILABLE: explicit OpenCode fixture required');
  const fixture = JSON.parse(readFileSync(file, 'utf8')) as OpenCodeNativeFixture;
  for (const runtime of ['CLI', 'TUI']) {
    for (const disposition of ['allowed', 'denied'] as const) {
      const control = new OpenCodeNativeWriteActor(fixture);
      await control.prepare('OpenCode V1', '1.18.23', runtime);
      control.setPolicy(disposition);
      await control.attempt();
      control.assertOutcome();
    }
  }
});
