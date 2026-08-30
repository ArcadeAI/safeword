import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import rootPackageJson from '../../../package.json' with { type: 'json' };
import packageJson from '../package.json' with { type: 'json' };
import {
  sealClaudePluginCatalogue,
  writeClaudePluginCatalogue,
} from '../src/claude-plugin/catalogue.js';
import { normalizePluginCliBundle } from '../src/plugin-cli-bundle.js';
import { requirePinnedBunVersion } from './bun-version.js';
import { generatedTreeDifferences, reconcileGeneratedTree } from './generated-tree-differences.js';

await import('./generate-scenario-rubric.js');
await import('./generate-plan-rubric.js');
await import('./generate-quality-rubric.js');

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const repoRoot = nodePath.resolve(packageRoot, '../..');
const checkOnly = process.argv.includes('--check');
const temporaryRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-plugin-'));
const pluginRoot = temporaryRoot;
const shippedRoot = nodePath.join(repoRoot, 'plugin');
const authoredShippedFiles = ['README.md'] as const;

try {
  // @ts-expect-error -- this production generator executes under Bun; the CLI's
  // Node-targeted tsconfig intentionally does not expose Bun globals elsewhere.
  requirePinnedBunVersion(rootPackageJson.packageManager, Bun.version);

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
  const cliBundle = normalizePluginCliBundle(await cliBuild.outputs[0].text());
  const assets = writeClaudePluginCatalogue(
    {
      cliBundle,
      sourceRoot: nodePath.join(packageRoot, 'src'),
      templatesRoot: nodePath.join(packageRoot, 'templates'),
      version: packageJson.version,
    },
    pluginRoot,
  );
  const formattedPaths = assets
    .filter(
      asset =>
        asset.relativePath.endsWith('.md') ||
        asset.relativePath.endsWith('.ts') ||
        asset.relativePath === 'runtime/dispatch.js',
    )
    .map(asset => nodePath.join(pluginRoot, asset.relativePath));
  const prettier = spawnSync(
    nodePath.join(repoRoot, 'node_modules', '.bin', 'prettier'),
    ['--config', nodePath.join(repoRoot, '.prettierrc'), '--write', ...formattedPaths],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if (prettier.status !== 0) {
    throw new Error(`Failed to format the Claude plugin: ${prettier.stderr}`);
  }
  // Prettier preserves indentation on blank lines inside indented Markdown
  // fences. Generated assets must remain byte-stable and pass diff hygiene.
  for (const formattedPath of formattedPaths) {
    if (!formattedPath.endsWith('.md')) continue;
    const content = readFileSync(formattedPath, 'utf8');
    writeFileSync(
      formattedPath,
      content
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n'),
    );
  }
  sealClaudePluginCatalogue(pluginRoot, packageJson.version);

  if (checkOnly) {
    const differences = generatedTreeDifferences(pluginRoot, shippedRoot, authoredShippedFiles);
    if (differences.length > 0) {
      throw new Error(
        `Generated Claude plugin is stale; run generate:claude-plugin:\n${differences.join('\n')}`,
      );
    }
    console.log(`Generated Claude plugin is current at ${packageJson.version}.`);
  } else {
    reconcileGeneratedTree(pluginRoot, shippedRoot, authoredShippedFiles);
    console.log(`Generated ${assets.length} Claude plugin assets.`);
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
