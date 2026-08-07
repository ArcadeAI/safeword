import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import rootPackageJson from '../../../package.json' with { type: 'json' };
import packageJson from '../package.json' with { type: 'json' };
import {
  normalizeClaudePluginCliBundle,
  sealClaudePluginCatalogue,
  writeClaudePluginCatalogue,
} from '../src/claude-plugin/catalogue.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const repoRoot = nodePath.resolve(packageRoot, '../..');

const expectedBunVersion = /^bun@(.+)$/.exec(rootPackageJson.packageManager)?.[1];
if (expectedBunVersion === undefined) {
  throw new Error('Root package.json must pin Bun with `"packageManager": "bun@<version>"`.');
}
// @ts-expect-error -- this production generator executes under Bun; the CLI's
// Node-targeted tsconfig intentionally does not expose Bun globals elsewhere.
const actualBunVersion = Bun.version;
if (actualBunVersion !== expectedBunVersion) {
  throw new Error(
    `Claude plugin generation requires Bun ${expectedBunVersion} from root package.json; ` +
      `found ${actualBunVersion}. Install the pinned version and ensure it is first on PATH.`,
  );
}

// `plugin/runtime/cli.js` comes out of Bun.build below, so its bytes depend on
// the Bun version. Check before writing any generated or sealed plugin files.
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
const cliBundle = normalizeClaudePluginCliBundle(await cliBuild.outputs[0].text());
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
  .filter(
    asset =>
      asset.relativePath.endsWith('.md') ||
      asset.relativePath.endsWith('.ts') ||
      asset.relativePath === 'runtime/dispatch.js',
  )
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
