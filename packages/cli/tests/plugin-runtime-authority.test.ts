import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { generateClaudePluginAssets } from '../src/claude-plugin/catalogue.js';
import { generateCodexPluginAssets } from '../src/codex-plugin/catalogue.js';
import { generateOpenCodeCatalogueAssets } from '../src/opencode/catalogue.js';
import { assertNativePluginRuntimeAuthority } from '../src/plugin-runtime-authority.js';
import { VERSION } from '../src/version.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const templatesRoot = nodePath.join(packageRoot, 'templates');

function generatedCatalogue(host: string) {
  if (host === 'Codex') {
    return generateCodexPluginAssets(nodePath.join(templatesRoot, 'skills'), VERSION);
  }
  if (host === 'Claude Code') {
    return generateClaudePluginAssets({
      cliBundle: 'console.log("fixture bundle");',
      sourceRoot: nodePath.join(packageRoot, 'src'),
      templatesRoot,
      version: VERSION,
    }).filter(asset => /^(?:agents|commands|skills)\//u.test(asset.relativePath));
  }
  return generateOpenCodeCatalogueAssets(templatesRoot);
}

describe('native catalogue release authority', () => {
  it.each(['Codex', 'Claude Code', 'OpenCode'])(
    'rejects a project-runtime reference in the generated %s catalogue',
    host => {
      const assets = generatedCatalogue(host);
      expect(() => {
        assertNativePluginRuntimeAuthority(assets);
      }).not.toThrow();
      const audit = assets.find(asset =>
        /(?:safeword-)?audit\/SKILL\.md$/u.test(asset.relativePath),
      );
      expect(audit).toBeDefined();
      if (audit === undefined) throw new Error(`${host} audit skill is missing`);

      const invalid = assets.map(asset =>
        asset === audit
          ? {
              ...asset,
              content: `${asset.content}\nRun \`bun .safeword/hooks/run-review.ts review run audit\`.\n`,
            }
          : asset,
      );

      expect(() => {
        assertNativePluginRuntimeAuthority(invalid);
      }).toThrow(audit.relativePath);
    },
  );
});
