import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DATA_ARCHITECTURE_OPEN_CODE_RATIONALE,
  type DataArchitectureDeliveryInput,
  type DataArchitectureDeliveryInventory,
  verifyDataArchitectureDelivery,
} from '../scripts/lib/data-architecture-delivery.js';
import { generateClaudePluginAssets } from '../src/claude-plugin/catalogue.js';
import { generateCodexPluginAssets } from '../src/codex-plugin/catalogue.js';
import { generateOpenCodeCatalogueAssets } from '../src/opencode/catalogue.js';
import { SAFEWORD_SCHEMA } from '../src/schema.js';
import { setupReconcileTest } from './helpers.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const packageRoot = nodePath.join(repoRoot, 'packages/cli');
const templatesRoot = nodePath.join(packageRoot, 'templates');
const sourceRoot = nodePath.join(packageRoot, 'src');
const deliveryInventory: DataArchitectureDeliveryInventory = {
  canonicalGuidePath: 'packages/cli/templates/guides/data-architecture-guide.md',
  installedGuidePath: '.safeword/guides/data-architecture-guide.md',
  managedGuidePaths: ['.safeword/guides/data-architecture-guide.md'],
  claudeGuidePath: 'resources/guides/data-architecture-guide.md',
  claudePlanningSourcePath: 'resources/SAFEWORD.md',
  claudePlanningTarget: '"${CLAUDE_PLUGIN_ROOT}"/resources/guides/data-architecture-guide.md',
  projectPlanningTarget: './.safeword/guides/data-architecture-guide.md',
  claudePathSubstitution: {
    from: '@.safeword/guides/',
    to: '@"${CLAUDE_PLUGIN_ROOT}"/resources/guides/',
  },
  openCodeRationale: DATA_ARCHITECTURE_OPEN_CODE_RATIONALE,
};

function file(relativePath: string): string {
  return readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');
}

function assetsByPath(
  assets: readonly { readonly relativePath: string; readonly content: string }[],
): Readonly<Record<string, string>> {
  return Object.fromEntries(assets.map(asset => [asset.relativePath, asset.content]));
}

function replaceInAsset(
  assets: Readonly<Record<string, string>>,
  path: string,
  from: string,
  to: string,
): Readonly<Record<string, string>> {
  const content = assets[path];
  if (content === undefined) throw new Error(`Fixture asset is missing at ${path}.`);
  const replaced = content.replace(from, () => to);
  if (replaced === content) throw new Error(`Fixture mutation anchor is missing from ${path}.`);
  return { ...assets, [path]: replaced };
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
    inventory: deliveryInventory,
    canonicalGuide: file(deliveryInventory.canonicalGuidePath),
    installedGuide: file(deliveryInventory.installedGuidePath),
    actualManagedGuidePaths: [
      ...Object.keys(SAFEWORD_SCHEMA.ownedFiles),
      ...Object.keys(SAFEWORD_SCHEMA.managedFiles),
    ].filter(path => path.endsWith('/data-architecture-guide.md')),
    claude: {
      assets: claudeAssets,
      planningSourcePath: deliveryInventory.claudePlanningSourcePath,
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
        '.safeword/SAFEWORD.md': file('.safeword/SAFEWORD.md'),
        '.safeword/guides/data-architecture-guide.md': file(deliveryInventory.installedGuidePath),
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

  it('installs the canonical guide through the supported reconciliation workflow', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-data-guide-'));
    try {
      await setupReconcileTest(projectDirectory);
      expect(
        readFileSync(nodePath.join(projectDirectory, deliveryInventory.installedGuidePath), 'utf8'),
      ).toBe(file(deliveryInventory.canonicalGuidePath));
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it.each([
    {
      diagnostic: 'Managed guide is missing at .safeword/guides/data-architecture-guide.md.',
      drift: 'a missing managed guide copy',
      mutate: (input: DataArchitectureDeliveryInput): DataArchitectureDeliveryInput => ({
        ...input,
        actualManagedGuidePaths: [],
      }),
    },
    {
      diagnostic:
        'Codex contains an unexpected guide copy at resources/guides/data-architecture-guide.md.',
      drift: 'an extra Codex-managed guide copy',
      mutate: (input: DataArchitectureDeliveryInput): DataArchitectureDeliveryInput => ({
        ...input,
        codex: {
          ...input.codex,
          assets: {
            ...input.codex.assets,
            'resources/guides/data-architecture-guide.md': input.canonicalGuide,
          },
        },
      }),
    },
    {
      diagnostic: 'Claude guide content differs at resources/guides/data-architecture-guide.md.',
      drift: 'Claude guide body drift',
      mutate: (input: DataArchitectureDeliveryInput): DataArchitectureDeliveryInput => ({
        ...input,
        claude: {
          ...input.claude,
          assets: {
            ...input.claude.assets,
            [input.inventory.claudeGuidePath]:
              `${input.claude.assets[input.inventory.claudeGuidePath]}\nDRIFT`,
          },
        },
      }),
    },
    {
      diagnostic: 'Claude guide content differs at resources/guides/data-architecture-guide.md.',
      drift: 'a non-path Claude substitution',
      mutate: (input: DataArchitectureDeliveryInput): DataArchitectureDeliveryInput => ({
        ...input,
        claude: {
          ...input.claude,
          assets: replaceInAsset(
            input.claude.assets,
            input.inventory.claudeGuidePath,
            input.inventory.claudePathSubstitution.to,
            '@./.safeword/guides/',
          ),
        },
      }),
    },
    {
      diagnostic: 'Planning target is missing at .safeword/guides/data-architecture-guide.md.',
      drift: 'a missing planning-reference target',
      mutate: (input: DataArchitectureDeliveryInput): DataArchitectureDeliveryInput => ({
        ...input,
        cursor: {
          ...input.cursor,
          assets: Object.fromEntries(
            Object.entries(input.cursor.assets).filter(
              ([path]) => path !== input.inventory.installedGuidePath,
            ),
          ),
        },
      }),
    },
    {
      diagnostic:
        'Cursor planning reference does not resolve exactly once to ./.safeword/guides/data-architecture-guide.md.',
      drift: 'an absent planning reference',
      mutate: (input: DataArchitectureDeliveryInput): DataArchitectureDeliveryInput => ({
        ...input,
        cursor: {
          ...input.cursor,
          assets: replaceInAsset(
            input.cursor.assets,
            input.cursor.planningSourcePath,
            input.inventory.projectPlanningTarget,
            '',
          ),
        },
      }),
    },
    {
      diagnostic:
        'Codex planning reference crosses surfaces to "${CLAUDE_PLUGIN_ROOT}"/resources/guides/data-architecture-guide.md.',
      drift: 'a cross-surface planning reference',
      mutate: (input: DataArchitectureDeliveryInput): DataArchitectureDeliveryInput => ({
        ...input,
        codex: {
          ...input.codex,
          assets: {
            ...replaceInAsset(
              input.codex.assets,
              input.codex.planningSourcePath,
              input.inventory.projectPlanningTarget,
              input.inventory.claudePlanningTarget,
            ),
            [input.inventory.claudePlanningTarget]: input.canonicalGuide,
          },
        },
      }),
    },
    {
      diagnostic:
        'Claude planning reference crosses surfaces to ./.safeword/guides/data-architecture-guide.md.',
      drift: 'a Claude cross-surface planning reference',
      mutate: (input: DataArchitectureDeliveryInput): DataArchitectureDeliveryInput => ({
        ...input,
        claude: {
          ...input.claude,
          assets: replaceInAsset(
            input.claude.assets,
            input.claude.planningSourcePath,
            input.inventory.claudePlanningTarget,
            input.inventory.projectPlanningTarget,
          ),
        },
      }),
    },
    {
      diagnostic:
        'Cursor planning reference crosses surfaces to "${CLAUDE_PLUGIN_ROOT}"/resources/guides/data-architecture-guide.md.',
      drift: 'a Cursor cross-surface planning reference',
      mutate: (input: DataArchitectureDeliveryInput): DataArchitectureDeliveryInput => ({
        ...input,
        cursor: {
          ...input.cursor,
          assets: replaceInAsset(
            input.cursor.assets,
            input.cursor.planningSourcePath,
            input.inventory.projectPlanningTarget,
            input.inventory.claudePlanningTarget,
          ),
        },
      }),
    },
    {
      diagnostic:
        'OpenCode contains an unexpected guide copy at guides/data-architecture-guide.md.',
      drift: 'an OpenCode guide copy or reference',
      mutate: (input: DataArchitectureDeliveryInput): DataArchitectureDeliveryInput => ({
        ...input,
        openCode: {
          assets: {
            ...input.openCode.assets,
            'guides/data-architecture-guide.md': input.canonicalGuide,
          },
        },
      }),
    },
    {
      diagnostic: 'OpenCode contains an unexpected guide reference at SAFEWORD.md.',
      drift: 'an OpenCode guide reference',
      mutate: (input: DataArchitectureDeliveryInput): DataArchitectureDeliveryInput => ({
        ...input,
        openCode: {
          assets: {
            ...input.openCode.assets,
            'SAFEWORD.md': `Read ${input.inventory.projectPlanningTarget}.`,
          },
        },
      }),
    },
  ])('rejects $drift with its mismatched path or content identified', ({ diagnostic, mutate }) => {
    const result = verifyDataArchitectureDelivery(mutate(deliveryFixture()));

    expect(result.accepted).toBe(false);
    expect(result.diagnostics).toContain(diagnostic);
  });
});
