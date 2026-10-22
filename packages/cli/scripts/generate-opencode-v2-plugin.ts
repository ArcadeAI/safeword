import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { parseArgs } from 'node:util';

import rootPackage from '../../../package.json' with { type: 'json' };
import sdkPackage from '../../opencode-v2-plugin/package.json' with { type: 'json' };
import {
  type PackagedCommandContract,
  readCanonicalCommandWrappers,
  readPackagedSkillContracts,
} from '../src/host-contract/catalogue.js';
import { writePortableCoreCatalogue } from '../src/host-contract/portable-core.js';
import { readWorkerContracts } from '../src/host-contract/workers.js';
import {
  openCodeCommandWorkflow,
  validateOpenCodeCatalogueReferences,
} from '../src/opencode/catalogue.js';
import { openCodeWorkflowName } from '../src/opencode/names.js';
import { generateOwnedPathsModule } from '../src/owned-paths.js';
import { OPENCODE_V2_PLUGIN_LAYOUT as layout, SAFEWORD_SCHEMA } from '../src/schema.js';
import { VERSION } from '../src/version.js';
import { buildPluginCliBundle, normalizePluginCliBundle } from './lib/build-plugin-cli-bundle.js';
import { publishFreshDirectory } from './lib/codex-plugin-generation.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const { values } = parseArgs({ options: { output: { type: 'string' } }, strict: true });
if (!values.output) throw new Error('Use --output <fresh plugin directory>');
await publishFreshDirectory(nodePath.resolve(values.output), async output => {
  writePortableCoreCatalogue(nodePath.join(packageRoot, 'templates'), output, VERSION);
  const workers = readWorkerContracts(nodePath.join(packageRoot, 'templates'));
  const knownSkills = new Set(
    readPackagedSkillContracts(nodePath.join(output, layout.skills)).map(skill => skill.name),
  );
  const commandWrappers = readCanonicalCommandWrappers(
    nodePath.join(packageRoot, 'templates'),
    name => `/${openCodeWorkflowName(name)}`,
  );
  validateOpenCodeCatalogueReferences(knownSkills, commandWrappers, []);
  const commands: PackagedCommandContract[] = commandWrappers.map(command => ({
    name: command.name,
    description: command.description,
    workflow: openCodeCommandWorkflow(command),
  }));
  writeFileSync(
    nodePath.join(output, layout.commands),
    `${JSON.stringify(commands, undefined, 2)}\n`,
  );
  writeFileSync(
    nodePath.join(output, layout.workers),
    `${JSON.stringify(workers, undefined, 2)}\n`,
  );
  mkdirSync(nodePath.dirname(nodePath.join(output, layout.runtime)), { recursive: true });
  writeFileSync(
    nodePath.join(output, layout.manifest),
    `${JSON.stringify(
      {
        name: 'safeword-opencode-v2',
        version: VERSION,
        type: 'module',
        exports: `./${layout.entry}`,
        dependencies: sdkPackage.dependencies,
      },
      undefined,
      2,
    )}\n`,
  );
  writeFileSync(
    nodePath.join(output, layout.templates, 'hooks/lib/owned-paths.ts'),
    generateOwnedPathsModule(SAFEWORD_SCHEMA),
  );
  writeFileSync(
    nodePath.join(output, layout.runtime),
    await buildPluginCliBundle(packageRoot, rootPackage.packageManager, 'OpenCode V2'),
  );
  for (const [entry, destination] of [
    [nodePath.resolve(packageRoot, '../opencode-v2-plugin/src/index.ts'), layout.entry],
    [nodePath.join(packageRoot, 'src/opencode/dispatcher.ts'), layout.dispatcher],
  ] as const) {
    // @ts-expect-error -- this generator executes under pinned Bun.
    const result = await Bun.build({
      entrypoints: [entry],
      target: 'bun',
      format: 'esm',
      splitting: false,
      write: false,
      external: ['@opencode/plugin'],
      define: {
        'process.env.NODE_ENV': JSON.stringify('development'),
        __SAFEWORD_OPENCODE_LAYOUT__: JSON.stringify(layout),
      },
    });
    if (!result.success || result.outputs.length !== 1)
      throw new Error(`OpenCode V2 bundle failed: ${result.logs.join('\n')}`);
    writeFileSync(
      nodePath.join(output, destination),
      normalizePluginCliBundle(await result.outputs[0].text()),
    );
  }
});
