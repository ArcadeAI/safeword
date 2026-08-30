import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import rootPackageJson from '../../../package.json' with { type: 'json' };
import { writeCodexPluginCatalogue } from '../src/codex-plugin/catalogue.js';
import { VERSION } from '../src/version.js';
import { buildPluginCliBundle } from './lib/build-plugin-cli-bundle.js';

await import('./generate-scenario-rubric.js');
await import('./generate-plan-rubric.js');
await import('./generate-quality-rubric.js');

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
// Keep Codex hooks and skill commands independent from bunx's shared mutable
// package installation. This is the same standalone build shape as the Claude
// plugin runtime, emitted into the Codex plugin payload.
const cliBundle = await buildPluginCliBundle(packageRoot, rootPackageJson.packageManager, 'Codex');
const runtimeDirectory = nodePath.join(packageRoot, 'codex-plugin/runtime');
mkdirSync(runtimeDirectory, { recursive: true });
writeFileSync(nodePath.join(runtimeDirectory, 'cli.js'), cliBundle, { mode: 0o755 });
writeFileSync(
  nodePath.join(packageRoot, 'codex-plugin/package.json'),
  `${JSON.stringify({ name: 'safeword-codex-plugin', version: VERSION, type: 'module' }, undefined, 2)}\n`,
);

const assets = writeCodexPluginCatalogue(
  nodePath.join(packageRoot, 'templates/skills'),
  nodePath.join(packageRoot, 'codex-plugin'),
  VERSION,
);

console.log(`Generated ${assets.length} Codex plugin workflow assets.`);
