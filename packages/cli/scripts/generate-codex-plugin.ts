import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import rootPackageJson from '../../../package.json' with { type: 'json' };
import {
  adaptCodexWorkflowInvocations,
  writeCodexPluginCatalogue,
} from '../src/codex-plugin/catalogue.js';
import { VERSION } from '../src/version.js';
import { generatedTreeDifferences, reconcileGeneratedTree } from './generated-tree-differences.js';
import { buildPluginCliBundle } from './lib/build-plugin-cli-bundle.js';

await import('./generate-scenario-rubric.js');
await import('./generate-plan-rubric.js');
await import('./generate-quality-rubric.js');

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const checkOnly = process.argv.includes('--check');
const shippedRoot = nodePath.join(packageRoot, 'codex-plugin');
const generatedRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-'));
const authoredShippedFiles = ['.codex-plugin/plugin.json', 'hooks.json'] as const;

try {
  // Keep Codex hooks and skill commands independent from bunx's shared mutable
  // package installation. This is the same standalone build shape as the Claude
  // plugin runtime, emitted into the Codex plugin payload.
  const cliBundle = await buildPluginCliBundle(
    packageRoot,
    rootPackageJson.packageManager,
    'Codex',
  );
  const runtimeDirectory = nodePath.join(generatedRoot, 'runtime');
  mkdirSync(runtimeDirectory, { recursive: true });
  writeFileSync(nodePath.join(runtimeDirectory, 'cli.js'), cliBundle, { mode: 0o755 });
  writeFileSync(
    nodePath.join(generatedRoot, 'package.json'),
    `${JSON.stringify({ name: 'safeword-codex-plugin', version: VERSION, type: 'module' }, undefined, 2)}\n`,
  );

  const assets = writeCodexPluginCatalogue(
    nodePath.join(packageRoot, 'templates/skills'),
    generatedRoot,
    VERSION,
  );
  const knownSkillNames = new Set<string>();
  for (const asset of assets) {
    const [directory, skill, filename] = asset.relativePath.split(nodePath.sep);
    if (directory === 'skills' && skill !== undefined && filename === 'SKILL.md') {
      knownSkillNames.add(skill);
    }
  }

  const templatesDirectory = nodePath.join(generatedRoot, 'templates');
  const handbookSource = nodePath.join(packageRoot, 'templates/SAFEWORD.md');
  const handbook = adaptCodexWorkflowInvocations(
    readFileSync(handbookSource, 'utf8'),
    knownSkillNames,
  );
  mkdirSync(templatesDirectory, { recursive: true });
  writeFileSync(nodePath.join(templatesDirectory, 'SAFEWORD.md'), handbook);
  cpSync(
    nodePath.join(packageRoot, 'templates/hooks'),
    nodePath.join(templatesDirectory, 'hooks'),
    {
      recursive: true,
    },
  );

  if (checkOnly) {
    const differences = generatedTreeDifferences(generatedRoot, shippedRoot, authoredShippedFiles);
    if (differences.length > 0) {
      throw new Error(
        `Generated Codex plugin is stale; run generate:codex-plugin:\n${differences.join('\n')}`,
      );
    }
    console.log(`Generated Codex plugin is current at ${VERSION}.`);
  } else {
    reconcileGeneratedTree(generatedRoot, shippedRoot, authoredShippedFiles);
    console.log(`Generated ${assets.length} Codex plugin workflow assets.`);
  }
} finally {
  rmSync(generatedRoot, { recursive: true, force: true });
}
