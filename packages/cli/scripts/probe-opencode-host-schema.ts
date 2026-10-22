import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { proveOpenCodeHostSchemaRejection } from '../tests/helpers/opencode-host-schema-registration.js';
import type { OpenCodeNativeFixture } from '../tests/helpers/opencode-native-write.js';

const config = process.env.SAFEWORD_OPENCODE_TEST_CONFIG;
assert.ok(config, 'HOST_CONTRACT_PROOF_UNAVAILABLE: explicit OpenCode fixture required');
const fixture = JSON.parse(readFileSync(config, 'utf8')) as OpenCodeNativeFixture;
async function run(runtime: 'CLI' | 'TUI'): Promise<number> {
  try {
    await proveOpenCodeHostSchemaRejection(fixture, runtime);
    return 0;
  } catch (error) {
    console.error(error);
    return error instanceof Error &&
      error.message.includes('V2_REQUIRED_HOST_SCHEMA_REJECTION_MISSING')
      ? 2
      : 3;
  }
}
const cli = await run('CLI');
const tui = await run('TUI');
process.exitCode = Math.max(cli, tui);
