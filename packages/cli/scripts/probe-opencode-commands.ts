import { readFileSync } from 'node:fs';

import { OpenCodeNativeCatalogueActor } from '../tests/helpers/opencode-native-catalogue.js';
import type { OpenCodeNativeFixture } from '../tests/helpers/opencode-native-write.js';

const config = process.env.SAFEWORD_OPENCODE_TEST_CONFIG;
if (!config)
  throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: SAFEWORD_OPENCODE_TEST_CONFIG required');
const fixture = JSON.parse(readFileSync(config, 'utf8')) as OpenCodeNativeFixture;
async function run(runtime: 'CLI' | 'TUI'): Promise<number> {
  try {
    const actor = new OpenCodeNativeCatalogueActor(fixture, 'command');
    await actor.prepare('OpenCode V2', '2.0.32', runtime);
    actor.confirmCanonicalProbe();
    await actor.invokeWorkflow();
    actor.assertPackagedResult();
    return 0;
  } catch (error) {
    console.error(error);
    return error instanceof Error &&
      /NATIVE_OPENCODE_V2_COMMAND_MISSING|NATIVE_HELPER_ORIGIN_MISMATCH/u.test(error.message)
      ? 2
      : 3;
  }
}
const cli = await run('CLI');
const tui = await run('TUI');
process.exitCode = Math.max(cli, tui);
