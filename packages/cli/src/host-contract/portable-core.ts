import { cpSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import packageMetadata from '../../package.json' with { type: 'json' };
import { PORTABLE_PLUGIN_LAYOUT } from '../schema.js';
import { readPackagedSkillContracts, writePluginCatalogue } from './catalogue.js';
import { writePortableManifest } from './delivery.js';

/** Render one content graph; callers bundle the standalone runtime before registration. */
export function writePortableCoreCatalogue(
  templatesDirectory: string,
  outputDirectory: string,
  version: string,
  extensions: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {},
): void {
  writePluginCatalogue(
    nodePath.join(templatesDirectory, PORTABLE_PLUGIN_LAYOUT.skills),
    outputDirectory,
    version,
    {
      workflowInvocation: name => `the canonical ${name} workflow`,
      runtimeCommand: 'bun "$SAFEWORD_PLUGIN_RUNTIME"',
      introduction: [
        '## Packaged runtime',
        '',
        'Resolve [the bundled Safeword runtime](../../runtime/cli.js) relative to this SKILL.md file, not the project working directory.',
        'Before each shell block, set SAFEWORD_PLUGIN_RUNTIME to that resolved absolute file path in the same shell invocation.',
        'Keep PROJECT_DIR bound to the actual project. Never substitute a project helper or another agent cache.',
        'Canonical workflow names refer to the skills in this same package; use the host skill mechanism or read the matching packaged SKILL.md.',
      ].join('\n'),
    },
  );
  const catalogue = readPackagedSkillContracts(
    nodePath.join(outputDirectory, PORTABLE_PLUGIN_LAYOUT.skills),
  );
  writeFileSync(
    nodePath.join(outputDirectory, PORTABLE_PLUGIN_LAYOUT.catalogue),
    `${JSON.stringify(catalogue, undefined, 2)}\n`,
  );
  cpSync(templatesDirectory, nodePath.join(outputDirectory, PORTABLE_PLUGIN_LAYOUT.templates), {
    recursive: true,
  });
  writeFileSync(
    nodePath.join(outputDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: 'safeword-plugin-runtime',
        version,
        type: 'module',
      },
      undefined,
      2,
    )}\n`,
  );
  writePortableManifest(outputDirectory, {
    format: 'agent-plugins-1.0',
    metadata: {
      name: packageMetadata.name,
      version,
      description: packageMetadata.description,
      homepage: packageMetadata.homepage,
      repository: packageMetadata.repository.url,
      license: packageMetadata.license,
      keywords: packageMetadata.keywords,
    },
    extensions,
  });
}
