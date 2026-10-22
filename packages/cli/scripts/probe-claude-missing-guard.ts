import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { sealClaudePluginCatalogue } from '../src/claude-plugin/catalogue.js';
import { VERSION } from '../src/version.js';
import {
  ClaudeNativeContractActor,
  type ClaudeNativeFixture,
} from '../tests/helpers/claude-native-contract.js';
import { assertMatchingTree } from '../tests/helpers/codex-plugin-package.js';

const config = process.env.SAFEWORD_CLAUDE_TEST_CONFIG;
assert.ok(config, 'HOST_CONTRACT_PROOF_UNAVAILABLE: explicit owned Claude fixture required');
const fixture = JSON.parse(readFileSync(config, 'utf8')) as ClaudeNativeFixture;
const actor = new ClaudeNativeContractActor(fixture);
await actor.prepare();
const originals = new Map<string, Buffer>();
for (const root of [fixture.runtimePath, fixture.installedPath]) {
  for (const relative of ['hooks/hooks.json', 'inventory.json', 'identity.json']) {
    const path = nodePath.join(root, relative);
    originals.set(path, readFileSync(path));
  }
}
try {
  for (const root of [fixture.runtimePath, fixture.installedPath]) {
    const path = nodePath.join(root, 'hooks/hooks.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as {
      hooks: { PreToolUse: { hooks: { command: string }[] }[] };
    };
    const before = manifest.hooks.PreToolUse.length;
    manifest.hooks.PreToolUse = manifest.hooks.PreToolUse.filter(group =>
      group.hooks.every(hook => !hook.command.includes('/pre-tool-quality.ts')),
    );
    assert.ok(manifest.hooks.PreToolUse.length < before);
    writeFileSync(path, `${JSON.stringify(manifest, undefined, 2)}\n`);
    sealClaudePluginCatalogue(root, VERSION);
  }
  // This deliberately altered, sealed candidate is the negative fixture, not production evidence.
  await actor.prepare(fixture.runtimePath);
  let observed: unknown;
  try {
    await actor.proveWrite('denied');
  } catch (error) {
    observed = error;
  }
  assert.ok(observed instanceof Error);
  assert.ok(observed.message.includes('DENIED_SIDE_EFFECT_OBSERVED'), observed.message);
  console.log(
    'Missing native guard produces the real forbidden side effect and a product failure.',
  );
} finally {
  for (const [path, content] of originals) writeFileSync(path, content);
  assertMatchingTree(nodePath.resolve(import.meta.dirname, '../../../plugin'), fixture.runtimePath);
  assertMatchingTree(fixture.runtimePath, fixture.installedPath);
}
