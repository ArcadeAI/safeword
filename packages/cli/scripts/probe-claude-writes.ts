import { readFileSync } from 'node:fs';

import {
  ClaudeNativeContractActor,
  type ClaudeNativeFixture,
} from '../tests/helpers/claude-native-contract.js';

const path = process.env.SAFEWORD_CLAUDE_TEST_CONFIG;
async function run(
  fixture: ClaudeNativeFixture,
  disposition: 'denied' | 'allowed',
): Promise<number> {
  try {
    const actor = new ClaudeNativeContractActor(fixture);
    await actor.prepare();
    await actor.proveWrite(disposition);
    console.log(`claude-2.1.170-${disposition}-write: passed`);
    return 0;
  } catch (error) {
    console.error(error);
    const productFailure =
      error instanceof Error &&
      /DENIED_SIDE_EFFECT_OBSERVED|ALLOWED_SIDE_EFFECT_MISSING|NATIVE_GUARD_DISPATCH_MISSING/u.test(
        error.message,
      );
    return productFailure ? 2 : 3;
  }
}
if (path) {
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as ClaudeNativeFixture;
  for (const disposition of ['denied', 'allowed'] as const) {
    process.exitCode = await run(fixture, disposition);
    if (process.exitCode !== 0) break;
  }
} else {
  console.error('HOST_CONTRACT_PROOF_UNAVAILABLE: SAFEWORD_CLAUDE_TEST_CONFIG required');
  process.exitCode = 3;
}
