import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { writeCodexPluginCatalogue } from '../../src/codex-plugin/catalogue.js';
import { VERSION } from '../../src/version.js';
import { command } from './cursor-native-window.js';

export const NATIVE_CATALOGUE_PROBE_DESCRIPTION =
  'Runs the Safeword contract catalogue probe in an isolated native host test.';

export interface NativeCatalogueProbe {
  readonly packageRoot: string;
  readonly workflowMarker: string;
  readonly guideMarker: string;
  readonly helperMarker: string;
}

/** Vary only canonical fixture inputs before any host renderer runs. */
export function createCanonicalCatalogueInputs(
  directory: string,
  skill = 'explain',
): Omit<NativeCatalogueProbe, 'packageRoot'> & { canonicalRoot: string } {
  const canonicalRoot = nodePath.join(directory, 'canonical');
  const nonce = randomUUID();
  const markers = {
    workflowMarker: `WORKFLOW_${nonce}`,
    guideMarker: `GUIDE_${nonce}`,
    helperMarker: `HELPER_${nonce}`,
  };
  const cliRoot = nodePath.resolve(import.meta.dirname, '../..');
  cpSync(nodePath.join(cliRoot, 'templates'), canonicalRoot, { recursive: true });
  const skillDirectory = nodePath.join(canonicalRoot, 'skills', skill);
  writeFileSync(
    nodePath.join(skillDirectory, 'SKILL.md'),
    [
      '---',
      `name: ${skill}`,
      `description: ${NATIVE_CATALOGUE_PROBE_DESCRIPTION}`,
      '---',
      '',
      '# Native catalogue probe',
      '',
      `Workflow marker: ${markers.workflowMarker}`,
      '',
      'Read [the packaged guide](HOST_CONTRACT_GUIDE.md) and remember its marker.',
      'Invoke the runtime helper using exactly this command:',
      '',
      '```bash',
      'PROJECT_DIR="$PWD"',
      'bun "$PROJECT_DIR/.safeword/hooks/audit-principle-trace.ts" "$PROJECT_DIR"',
      '```',
      '',
      'Report the workflow marker, guide marker and actual helper output.',
      'If the supplied command fails or returns no helper marker, report that failure.',
      'Do not substitute another runtime path, install anything, simulate output or write receipts.',
      '',
    ].join('\n'),
  );
  writeFileSync(
    nodePath.join(skillDirectory, 'HOST_CONTRACT_GUIDE.md'),
    `# Packaged guide\n\nGuide marker: ${markers.guideMarker}\n`,
  );
  writeFileSync(
    nodePath.join(canonicalRoot, 'hooks', 'audit-principle-trace.ts'),
    [
      "import { writeFileSync } from 'node:fs';",
      "import nodePath from 'node:path';",
      "import { fileURLToPath } from 'node:url';",
      `const marker = ${JSON.stringify(markers.helperMarker)};`,
      'writeFileSync(',
      "  nodePath.join(process.cwd(), '.host-contract', 'native-helper.json'),",
      String.raw`  JSON.stringify({ marker, origin: fileURLToPath(import.meta.url), runtime: process.env.SAFEWORD_PLUGIN_CLI }) + "\n",`,
      ');',
      String.raw`process.stdout.write(marker + "\n");`,
      '',
    ].join('\n'),
  );
  return { canonicalRoot, ...markers };
}

/**
 * Exercise the production portable renderer; never repair the generated runtime.
 * This is resource-binding proof, not shipped manifest or package admission proof.
 */
export async function createNativeCatalogueProbe(
  directory: string,
  generateCarrier?: (output: string) => Promise<unknown>,
  skill = 'explain',
): Promise<NativeCatalogueProbe> {
  const packageRoot = nodePath.join(directory, 'candidate');
  const { canonicalRoot, ...markers } = createCanonicalCatalogueInputs(directory, skill);
  const cliRoot = nodePath.resolve(import.meta.dirname, '../..');
  const portableCoreModule = nodePath.join(cliRoot, 'src', 'host-contract', 'portable-core.ts');
  if (existsSync(portableCoreModule)) {
    if (generateCarrier) await generateCarrier(packageRoot);
    else {
      await command(
        'bun',
        [
          nodePath.join(cliRoot, 'scripts/generate-codex-plugin.ts'),
          '--portable-core',
          '--version',
          VERSION,
          '--output',
          packageRoot,
        ],
        { timeout: 120_000 },
      );
    }
    const generatedManifest = readFileSync(nodePath.join(packageRoot, 'package.json'));
    const runtime = nodePath.join(packageRoot, 'runtime/cli.js');
    assert.ok(existsSync(runtime), 'Production portable generator omitted its runtime');
    const generatedRuntime = readFileSync(runtime);
    const production = (await import(pathToFileURL(portableCoreModule).href)) as {
      writePortableCoreCatalogue?: (
        templatesDirectory: string,
        outputDirectory: string,
        version: string,
      ) => void | Promise<void>;
    };
    if (typeof production.writePortableCoreCatalogue !== 'function') {
      throw new TypeError('Portable core module does not export its production catalogue writer');
    }
    await production.writePortableCoreCatalogue(canonicalRoot, packageRoot, VERSION);
    // Preserve the carrier's generated native identity while varying canonical test content.
    writeFileSync(nodePath.join(packageRoot, 'package.json'), generatedManifest);
    assert.deepEqual(readFileSync(runtime), generatedRuntime, 'Catalogue replaced the runtime');
  } else {
    // The current baseline exposes only the existing renderer. A minimal test
    // carrier lets its runtime bindings fail during real native use instead of
    // treating an absent new module as behavioral RED.
    mkdirSync(packageRoot);
    writeFileSync(
      nodePath.join(packageRoot, 'plugin.json'),
      `${JSON.stringify({
        $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
        name: 'safeword-contract-candidate',
        description: 'Independent carrier for the production Safeword catalogue under test.',
        version: VERSION,
        author: { name: 'Safeword test fixture' },
      })}\n`,
    );
    writeCodexPluginCatalogue(nodePath.join(canonicalRoot, 'skills'), packageRoot, VERSION);
    const renderedWorkflow = readFileSync(
      nodePath.join(packageRoot, 'skills', skill, 'SKILL.md'),
      'utf8',
    );
    assert.ok(renderedWorkflow.includes('project runtime audit-principle-trace'));
    assert.ok(renderedWorkflow.includes('plugins/cache/safeword/safeword/'));
    cpSync(canonicalRoot, nodePath.join(packageRoot, 'templates'), { recursive: true });
    cpSync(
      nodePath.join(cliRoot, 'codex-plugin', 'package.json'),
      nodePath.join(packageRoot, 'package.json'),
    );
    cpSync(
      nodePath.join(cliRoot, 'codex-plugin', 'runtime'),
      nodePath.join(packageRoot, 'runtime'),
      {
        recursive: true,
      },
    );
  }
  return { packageRoot, ...markers };
}
