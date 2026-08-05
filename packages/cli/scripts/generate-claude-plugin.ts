import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import packageJson from '../package.json' with { type: 'json' };
import {
  sealClaudePluginCatalogue,
  writeClaudePluginCatalogue,
} from '../src/claude-plugin/catalogue.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const repoRoot = nodePath.resolve(packageRoot, '../..');

// Run this under the bun version pinned in the root package.json's
// `packageManager`. `plugin/runtime/cli.js` comes out of Bun.build below, so its
// bytes depend on the bun that runs this script — different versions emit
// different code for identical source. CI's catalogue-freshness gate regenerates
// and rejects any diff, so a bundle built with another bun can never pass it.
// Note that `bun run generate:claude-plugin` re-invokes `bun` from PATH: the
// pinned version has to be FIRST ON PATH, not merely the binary you launched.
// @ts-expect-error -- this production generator executes under Bun; the CLI's
// Node-targeted tsconfig intentionally does not expose Bun globals elsewhere.
const cliBuild = await Bun.build({
  entrypoints: [nodePath.join(packageRoot, 'src', 'cli.ts')],
  format: 'esm',
  packages: 'bundle',
  splitting: false,
  target: 'bun',
  write: false,
});
if (!cliBuild.success || cliBuild.outputs.length !== 1 || cliBuild.outputs[0] === undefined) {
  throw new Error(`Failed to bundle the Claude plugin CLI: ${cliBuild.logs.join('\n')}`);
}
const cliBundle = await cliBuild.outputs[0].text();
const assets = writeClaudePluginCatalogue(
  {
    cliBundle,
    sourceRoot: nodePath.join(packageRoot, 'src'),
    templatesRoot: nodePath.join(packageRoot, 'templates'),
    version: packageJson.version,
  },
  nodePath.join(repoRoot, 'plugin'),
);
const formattedPaths = assets
  .filter(asset => asset.relativePath.endsWith('.md') || asset.relativePath.endsWith('.ts'))
  .map(asset => nodePath.join(repoRoot, 'plugin', asset.relativePath));
const prettier = spawnSync(
  nodePath.join(repoRoot, 'node_modules', '.bin', 'prettier'),
  ['--write', ...formattedPaths],
  { cwd: repoRoot, encoding: 'utf8' },
);
if (prettier.status !== 0) {
  throw new Error(`Failed to format the Claude plugin: ${prettier.stderr}`);
}
sealClaudePluginCatalogue(nodePath.join(repoRoot, 'plugin'), packageJson.version);

console.log(`Generated ${assets.length} Claude plugin assets.`);
