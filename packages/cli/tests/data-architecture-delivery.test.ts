import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  type DataArchitectureDeliveryInput,
  verifyDataArchitectureDelivery,
} from '../scripts/lib/data-architecture-delivery.js';
import { generateClaudePluginAssets } from '../src/claude-plugin/catalogue.js';
import { generateCodexPluginAssets } from '../src/codex-plugin/catalogue.js';
import { generateOpenCodeCatalogueAssets } from '../src/opencode/catalogue.js';
import { SAFEWORD_SCHEMA } from '../src/schema.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const packageRoot = nodePath.join(repoRoot, 'packages/cli');
const templatesRoot = nodePath.join(packageRoot, 'templates');
const sourceRoot = nodePath.join(packageRoot, 'src');

function file(relativePath: string): string {
  return readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');
}

function assetsByPath(
  assets: readonly { readonly relativePath: string; readonly content: string }[],
): Readonly<Record<string, string>> {
  return Object.fromEntries(assets.map(asset => [asset.relativePath, asset.content]));
}

function deliveryFixture(): DataArchitectureDeliveryInput {
  const claudeAssets = assetsByPath(
    generateClaudePluginAssets({
      cliBundle: 'export {};\n',
      sourceRoot,
      templatesRoot,
      version: '0.0.0-test',
    }),
  );
  const codexAssets = assetsByPath(
    generateCodexPluginAssets(nodePath.join(templatesRoot, 'skills'), '0.0.0-test'),
  );
  const openCodeAssets = assetsByPath(generateOpenCodeCatalogueAssets(templatesRoot));

  return {
    canonicalGuide: file('packages/cli/templates/guides/data-architecture-guide.md'),
    installedGuide: file('.safeword/guides/data-architecture-guide.md'),
    managedGuidePaths: [
      ...Object.keys(SAFEWORD_SCHEMA.ownedFiles),
      ...Object.keys(SAFEWORD_SCHEMA.managedFiles),
    ].filter(path => path.endsWith('/data-architecture-guide.md')),
    claude: {
      assets: claudeAssets,
      planningSourcePath: 'resources/SAFEWORD.md',
    },
    codex: {
      assets: {
        ...codexAssets,
        'SAFEWORD.md': file('packages/cli/codex-plugin/templates/SAFEWORD.md'),
      },
      planningSourcePath: 'SAFEWORD.md',
    },
    cursor: {
      assets: {
        '.safeword/SAFEWORD.md': file('packages/cli/templates/SAFEWORD.md'),
        '.safeword/guides/data-architecture-guide.md': file(
          'packages/cli/templates/guides/data-architecture-guide.md',
        ),
      },
      planningSourcePath: '.safeword/SAFEWORD.md',
    },
    openCode: { assets: openCodeAssets },
  };
}

describe('data architecture guide delivery', () => {
  it('resolves one coherent guide through every supported host delivery model', () => {
    expect(verifyDataArchitectureDelivery(deliveryFixture())).toEqual({
      accepted: true,
      diagnostics: [],
    });
  });
});
