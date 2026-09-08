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
import { generatedTreeDifferences, reconcileGeneratedTree } from './generated-tree-differences.js';
import { buildPluginCliBundle } from './lib/build-plugin-cli-bundle.js';

await import('./generate-scenario-rubric.js');
await import('./generate-plan-rubric.js');
await import('./generate-quality-rubric.js');

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const repoRoot = nodePath.resolve(packageRoot, '../..');
const checkOnly = process.argv.includes('--check');
const temporaryRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-plugin-'));
const pluginRoot = temporaryRoot;
// Testability seam: release-contract scenarios compare canonical generation to
// a deliberately stale copy without mutating the committed plugin tree.
const shippedRoot =
  process.env.SAFEWORD_CLAUDE_GENERATED_PLUGIN_ROOT ?? nodePath.join(repoRoot, 'plugin');
const authoredShippedFiles = ['README.md'] as const;

try {
  const cliBundle = await buildPluginCliBundle(
    packageRoot,
    rootPackageJson.packageManager,
    'Claude',
  );
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
