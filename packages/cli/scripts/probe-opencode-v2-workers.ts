import { readFileSync } from 'node:fs';

import { proveOpenCodeWorker } from '../tests/helpers/opencode-native-worker.js';
import type { OpenCodeNativeFixture } from '../tests/helpers/opencode-native-write.js';

const config = process.env.SAFEWORD_OPENCODE_TEST_CONFIG;
if (!config)
  throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: SAFEWORD_OPENCODE_TEST_CONFIG required');
const fixture = JSON.parse(readFileSync(config, 'utf8')) as OpenCodeNativeFixture;
async function run(runtime: 'CLI' | 'TUI'): Promise<number> {
  try {
    await proveOpenCodeWorker(fixture, runtime);
    return 0;
  } catch (error) {
    console.error(error);
    return error instanceof Error &&
      /V2_WORKER_(?:CONTEXT_LEAK|FORBIDDEN_ACTION)/u.test(error.message)
      ? 2
      : 3;
  }
}
const cli = await run('CLI');
const tui = await run('TUI');
process.exitCode = Math.max(cli, tui);
