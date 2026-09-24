import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import rootPackageJson from '../../../package.json' with { type: 'json' };
import {
  adaptCodexWorkflowInvocations,
  writeCodexPluginCatalogue,
} from '../src/codex-plugin/catalogue.js';
import { VERSION } from '../src/version.js';
import { generatePlanRubric } from './generate-plan-rubric.js';
import { generateQualityRubric } from './generate-quality-rubric.js';
import { generateRedRubric } from './generate-red-rubric.js';
import { generateScenarioRubric } from './generate-scenario-rubric.js';
import { generatedTreeDifferences, reconcileGeneratedTree } from './generated-tree-differences.js';
import { buildPluginCliBundle } from './lib/build-plugin-cli-bundle.js';
import {
  parseCodexPluginGenerationOptions,
  publishFreshDirectory,
} from './lib/codex-plugin-generation.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const shippedRoot = nodePath.join(packageRoot, 'codex-plugin');
const authoredShippedFiles = ['.codex-plugin/plugin.json', 'hooks.json'] as const;
const options = parseCodexPluginGenerationOptions(process.argv.slice(2), VERSION);

const outputRelativeToShippedRoot =
  options.output === undefined ? undefined : nodePath.relative(shippedRoot, options.output);
if (
  outputRelativeToShippedRoot !== undefined &&
  (outputRelativeToShippedRoot === '' ||
    (outputRelativeToShippedRoot !== '..' &&
      !outputRelativeToShippedRoot.startsWith(`..${nodePath.sep}`) &&
      !nodePath.isAbsolute(outputRelativeToShippedRoot)))
) {
  throw new Error('Custom output must be outside the checked-in Codex plugin directory');
}

const rubricResults = [
  generateScenarioRubric(options.checkOnly),
  generatePlanRubric(options.checkOnly),
  generateQualityRubric(options.checkOnly),
  generateRedRubric(options.checkOnly),
];
if (options.checkOnly && rubricResults.includes('stale')) {
  throw new Error('Cannot check the Codex plugin while a generated runtime rubric is stale.');
}

async function generatePlugin(
  generatedRoot: string,
  includeAuthoredFiles: boolean,
): Promise<number> {
  const manifestPath = nodePath.join(shippedRoot, '.codex-plugin/plugin.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  if (manifest.version !== VERSION) {
    throw new Error(`Codex plugin manifest does not declare package version ${VERSION}`);
  }
  const builtVersion = options.effectiveVersion === VERSION ? undefined : options.effectiveVersion;
  // Keep Codex hooks and skill commands independent from bunx's shared mutable
  // package installation. This is the same standalone build shape as the Claude
  // plugin runtime, emitted into the Codex plugin payload.
  const cliBundle = await buildPluginCliBundle(
    packageRoot,
    rootPackageJson.packageManager,
    'Codex',
    builtVersion,
  );
  const runtimeDirectory = nodePath.join(generatedRoot, 'runtime');
  mkdirSync(runtimeDirectory, { recursive: true });
  writeFileSync(nodePath.join(runtimeDirectory, 'cli.js'), cliBundle, { mode: 0o755 });
  writeFileSync(
    nodePath.join(generatedRoot, 'package.json'),
    `${JSON.stringify(
      { name: 'safeword-codex-plugin', version: options.effectiveVersion, type: 'module' },
      undefined,
      2,
    )}\n`,
  );

  const assets = writeCodexPluginCatalogue(
    nodePath.join(packageRoot, 'templates/skills'),
    generatedRoot,
    options.effectiveVersion,
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
  // runtime/cli.js is the same standalone bundle shipped by npm and expects
  // the canonical flat templates/ tree. Native skills remain separately
  // adapted at plugin root; this copy exists for CLI resource consumers.
  cpSync(nodePath.join(packageRoot, 'templates'), templatesDirectory, { recursive: true });
  const resourcesDirectory = nodePath.join(generatedRoot, 'resources');
  mkdirSync(resourcesDirectory, { recursive: true });
  writeFileSync(nodePath.join(resourcesDirectory, 'SAFEWORD.md'), handbook);

  if (includeAuthoredFiles) {
    manifest.version = options.effectiveVersion;
    const manifestDirectory = nodePath.join(generatedRoot, '.codex-plugin');
    mkdirSync(manifestDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(manifestDirectory, 'plugin.json'),
      `${JSON.stringify(manifest, undefined, 2)}\n`,
    );
    cpSync(nodePath.join(shippedRoot, 'hooks.json'), nodePath.join(generatedRoot, 'hooks.json'));
  }

  return assets.length;
}

if (options.output === undefined) {
  const generatedRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-'));
  try {
    const assetCount = await generatePlugin(generatedRoot, false);
    if (options.checkOnly) {
      const differences = generatedTreeDifferences(
        generatedRoot,
        shippedRoot,
        authoredShippedFiles,
      );
      if (differences.length > 0) {
        throw new Error(
          `Generated Codex plugin is stale; run generate:codex-plugin:\n${differences.join('\n')}`,
        );
      }
      console.log(`Generated Codex plugin is current at ${VERSION}.`);
    } else {
      reconcileGeneratedTree(generatedRoot, shippedRoot, authoredShippedFiles);
      console.log(`Generated ${assetCount} Codex plugin workflow assets.`);
    }
  } finally {
    rmSync(generatedRoot, { recursive: true, force: true });
  }
} else {
  let assetCount = 0;
  await publishFreshDirectory(options.output, async generatedRoot => {
    assetCount = await generatePlugin(generatedRoot, true);
  });
  console.log(
    `Generated ${assetCount} Codex plugin workflow assets at ${options.effectiveVersion} in ${options.output}.`,
  );
}
