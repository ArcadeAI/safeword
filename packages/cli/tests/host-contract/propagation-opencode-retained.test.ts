import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { OpenCodeNativeCatalogueActor } from '../helpers/opencode-native-catalogue.js';
import type * as NativeDriver from '../helpers/opencode-native-driver.js';

const service = vi.hoisted(() => ({ port: 18_000 }));

// Only the external model service is substituted. The real runModelFixture and
// runOpenCodeTurn launch an owned shell executable, NOT a native host/model.
// No native events, guard decisions or proof-success JSON are returned.
vi.mock('../helpers/opencode-native-driver.js', async original => ({
  ...(await original<typeof NativeDriver>()),
  openCodeScriptedModelFixture: vi.fn(async () => {
    await Promise.resolve();
    return {
      url: `http://127.0.0.1:${++service.port}/`,
      results: [],
      attempts: 0,
      finish: 'SOURCE_PROCESS_STUB_FINISH',
      close() {},
    };
  }),
}));
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function prepared() {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-retained-opencode-'));
  roots.push(root);
  const binary = nodePath.join(root, 'external-process');
  writeFileSync(
    binary,
    '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "opencode v2.4.1"; else echo SOURCE_PROCESS_STUB_FINISH; fi\n',
    { mode: 0o755 },
  );
  const actor = new OpenCodeNativeCatalogueActor({ runsDirectory: root, v2Binary: binary });
  await actor.prepare('OpenCode V2', '2.4.1', 'CLI');
  const directory = readdirSync(root).find(name => name.startsWith('opencode-native-'));
  expect(directory).toBeDefined();
  const config = nodePath.join(root, directory ?? '', 'project/opencode.json');
  return { actor, config };
}

it('runs the real retained model-fixture controller twice with a fresh loopback URL', async () => {
  const { actor, config } = await prepared();
  await actor.invokeWorkflow();
  const first = JSON.parse(readFileSync(config, 'utf8')).provider.fixture.options.baseURL;
  await expect(
    actor.invokeWorkflow(),
    'OPENCODE_RETAINED_SECOND_TURN_UNAVAILABLE',
  ).resolves.toBeUndefined();
  const second = JSON.parse(readFileSync(config, 'utf8')).provider.fixture.options.baseURL;
  expect(second).not.toBe(first);
});
it('preserves the original installer-owned config refusal', async () => {
  const { actor, config } = await prepared();
  const content = '{"installer":"must remain unchanged"}';
  writeFileSync(config, content);
  await expect(actor.invokeWorkflow()).rejects.toThrow('installer supplied a project config');
  expect(readFileSync(config, 'utf8')).toBe(content);
});
it('refuses to remove its prior config if another writer changed the bytes', async () => {
  const { actor, config } = await prepared();
  await actor.invokeWorkflow();
  const content = '{"foreign":"changed after turn"}';
  writeFileSync(config, content);
  await expect(actor.invokeWorkflow()).rejects.toThrow('OPENCODE_OWNED_MODEL_CONFIG_CHANGED');
  expect(readFileSync(config, 'utf8')).toBe(content);
});
