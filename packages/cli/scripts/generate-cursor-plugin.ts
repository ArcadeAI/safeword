import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { parseArgs } from 'node:util';

import rootPackage from '../../../package.json' with { type: 'json' };
import { cursorPluginBindings } from '../src/cursor-plugin/bindings.js';
import { generateOwnedPathsModule } from '../src/owned-paths.js';
import { CURSOR_PLUGIN_LAYOUT, SAFEWORD_SCHEMA } from '../src/schema.js';
import { VERSION } from '../src/version.js';
import { buildPluginCliBundle, normalizePluginCliBundle } from './lib/build-plugin-cli-bundle.js';
import { publishFreshDirectory } from './lib/codex-plugin-generation.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const { values } = parseArgs({ options: { output: { type: 'string' } }, strict: true });
if (!values.output) throw new Error('Use --output <fresh plugin directory>');
await publishFreshDirectory(nodePath.resolve(values.output), async output => {
  for (const relative of ['.cursor-plugin', 'hooks', 'runtime'])
    mkdirSync(nodePath.join(output, relative), { recursive: true });
  const hooks: Record<string, object[]> = {};
  for (const binding of cursorPluginBindings()) {
    const eventHooks = (hooks[binding.event] ??= []);
    eventHooks.push({
      ...binding.configuration,
      command: `bun "\${CURSOR_PLUGIN_ROOT}"/${CURSOR_PLUGIN_LAYOUT.dispatcher} ${binding.id}`,
    });
  }
  const writeJson = (relative: string, value: unknown): void => {
    writeFileSync(nodePath.join(output, relative), `${JSON.stringify(value, undefined, 2)}\n`);
  };
  writeJson(CURSOR_PLUGIN_LAYOUT.manifest, {
    name: 'safeword-cursor',
    version: VERSION,
    hooks: `./${CURSOR_PLUGIN_LAYOUT.hooks}`,
  });
  writeJson(CURSOR_PLUGIN_LAYOUT.hooks, { version: 1, hooks });
  writeJson('package.json', {
    name: 'safeword-cursor-plugin',
    version: VERSION,
    type: 'module',
  });
  cpSync(
    nodePath.join(packageRoot, 'templates'),
    nodePath.join(output, CURSOR_PLUGIN_LAYOUT.templates),
    { recursive: true },
  );
  writeFileSync(
    nodePath.join(output, CURSOR_PLUGIN_LAYOUT.templates, 'hooks/lib/owned-paths.ts'),
    generateOwnedPathsModule(SAFEWORD_SCHEMA),
  );
  const cli = await buildPluginCliBundle(packageRoot, rootPackage.packageManager, 'Cursor');
  writeFileSync(nodePath.join(output, CURSOR_PLUGIN_LAYOUT.runtime), cli);
  // @ts-expect-error -- this generator executes under pinned Bun.
  const dispatcher = await Bun.build({
    entrypoints: [nodePath.join(packageRoot, 'src/cursor-plugin/dispatch.ts')],
    target: 'bun',
    format: 'esm',
    splitting: false,
    write: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('development') },
  });
  if (!dispatcher.success || dispatcher.outputs.length !== 1)
    throw new Error('Cursor dispatcher bundle failed');
  writeFileSync(
    nodePath.join(output, CURSOR_PLUGIN_LAYOUT.dispatcher),
    normalizePluginCliBundle(await dispatcher.outputs[0].text()),
  );
});
