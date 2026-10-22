import { readFileSync } from 'node:fs';

import { proveOpenCodeCoexistence } from '../tests/helpers/opencode-native-coexistence.js';
import type { OpenCodeNativeFixture } from '../tests/helpers/opencode-native-write.js';

const config = process.env.SAFEWORD_OPENCODE_TEST_CONFIG;
if (!config)
  throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: SAFEWORD_OPENCODE_TEST_CONFIG required');
const fixture = JSON.parse(readFileSync(config, 'utf8')) as OpenCodeNativeFixture;
async function run(runtime: 'CLI' | 'TUI'): Promise<number> {
  try {
    await proveOpenCodeCoexistence(fixture, runtime);
    return 0;
  } catch (error) {
    console.error(error);
    return error instanceof Error && error.message.includes('V2_ENROLLED_GUARD_MISSING') ? 2 : 3;
  }
}
const cli = await run('CLI');
const tui = await run('TUI');
process.exitCode = Math.max(cli, tui);
