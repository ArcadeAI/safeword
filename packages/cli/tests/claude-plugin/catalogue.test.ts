import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizePluginCliBundle } from '../../scripts/lib/build-plugin-cli-bundle.js';
import {
  assertClaudePluginAssetReferences,
  generateClaudePluginAssets,
} from '../../src/claude-plugin/catalogue.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');

describe('Claude plugin catalogue generation', () => {
  it('normalizes machine-specific Bun install instance paths', () => {
    const firstBundle = [
      '// ../../node_modules/.bun/@secretlint+core@13.0.4+2b91fc17bf64bdfd/node_modules/@secretlint/core/index.js',
      '// ../../node_modules/.bun/debug@4.4.3+2b91fc17bf64bdfd/node_modules/debug/src/index.js',
      'console.log("bundle");',
    ].join('\n');
    const secondBundle = firstBundle.replaceAll('2b91fc17bf64bdfd', '7f1b8241f77f2ecc');

    const normalized = normalizePluginCliBundle(firstBundle);

    expect(normalized).toBe(normalizePluginCliBundle(secondBundle));
    expect(normalized).toContain(
      'node_modules/.bun/@secretlint+core@13.0.4/node_modules/@secretlint/core/index.js',
    );
    expect(normalized).toContain('node_modules/.bun/debug@4.4.3/node_modules/debug/src/index.js');
    expect(normalized).toContain('console.log("bundle");');
  });

  it('preserves literal trailing whitespace and normalizes nested Bun install paths', () => {
    const bundle = [
      'const content = `keep  ',
      'this tab stays\t`;',
      '// ../../node_modules/.bun/outer@1.0.0+2b91fc17bf64bdfd/node_modules/.bun/inner@1.0.0+7f1b8241f77f2ecc/node_modules/inner/index.js',
    ].join('\n');

    expect(normalizePluginCliBundle(bundle)).toBe(
      bundle.replace('+2b91fc17bf64bdfd', '').replace('+7f1b8241f77f2ecc', ''),
    );
  });

  it('rejects generated assets that retain project-local skill references', () => {
    expect(() => {
      assertClaudePluginAssetReferences([
        {
          relativePath: 'agents/reviewer.md',
          content: 'Read .safeword/skills/finish-review/REVIEWER.md',
        },
      ]);
    }).toThrow('depends on project framework path .safeword/skills/finish-review/REVIEWER.md');
  });

  it('packages the handbook so SessionStart never needs project-local .safeword/SAFEWORD.md', () => {
    const assets = generateClaudePluginAssets({
      cliBundle: 'console.log("stub cli bundle");',
      sourceRoot: nodePath.join(packageRoot, 'src'),
      templatesRoot: nodePath.join(packageRoot, 'templates'),
      version: '0.0.0-test',
    });

    const packagedHandbook = assets.find(asset => asset.relativePath === 'resources/SAFEWORD.md');

    expect(packagedHandbook).toBeDefined();
    expect(packagedHandbook?.content.length).toBeGreaterThan(0);
    expect(packagedHandbook?.content).not.toMatch(/\.safeword\/(?:guides|scripts)\//u);
  });

  it('packages the canonical template root consumed by the standalone CLI', () => {
    const assets = generateClaudePluginAssets({
      cliBundle: 'console.log("stub cli bundle");',
      sourceRoot: nodePath.join(packageRoot, 'src'),
      templatesRoot: nodePath.join(packageRoot, 'templates'),
      version: '0.0.0-test',
    });
    const paths = new Set(assets.map(asset => asset.relativePath));

    for (const relativePath of [
      'templates/SAFEWORD.md',
      'templates/spec-template.md',
      'templates/skills/bdd/SKILL.md',
      'templates/hooks/pre-tool-quality.ts',
      'templates/workflows/remote-tests.yml',
    ]) {
      expect(paths).toContain(relativePath);
    }
  });

  it('packages event groups for exactly the manifest events dispatched as aggregates', () => {
    const assets = generateClaudePluginAssets({
      cliBundle: 'console.log("stub cli bundle");',
      sourceRoot: nodePath.join(packageRoot, 'src'),
      templatesRoot: nodePath.join(packageRoot, 'templates'),
      version: '0.0.0-test',
    });
    const contents = new Map(assets.map(asset => [asset.relativePath, asset.content]));
    const manifest = JSON.parse(contents.get('hooks/hooks.json') ?? '{}') as {
      hooks?: Record<string, unknown>;
    };
    const eventGroups = JSON.parse(contents.get('runtime/event-groups.json') ?? '{}') as {
      groups?: Record<string, unknown>;
    };
    const aggregateEvents = Object.entries(manifest.hooks ?? {})
      .filter(([, entries]) => JSON.stringify(entries).includes('--event-group'))
      .map(([event]) => event)
      .toSorted((left, right) => left.localeCompare(right));

    expect(
      Object.keys(eventGroups.groups ?? {}).toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(aggregateEvents);
  });

  it('normalizes install-instance hashes out of the bundled dispatcher', () => {
    const assets = generateClaudePluginAssets({
      cliBundle: 'console.log("stub cli bundle");',
      sourceRoot: nodePath.join(packageRoot, 'src'),
      templatesRoot: nodePath.join(packageRoot, 'templates'),
      version: '0.0.0-test',
    });
    const dispatcher = assets.find(asset => asset.relativePath === 'runtime/dispatch.js');

    expect(dispatcher?.content).not.toMatch(/\+[\da-f]{16}[/\\]node_modules/iu);
  });

  it('runs the shared native runtime-authority gate during generation', () => {
    const assets = generateClaudePluginAssets({
      cliBundle: 'console.log("stub cli bundle");',
      sourceRoot: nodePath.join(packageRoot, 'src'),
      templatesRoot: nodePath.join(packageRoot, 'templates'),
      version: '0.0.0-test',
    });

    expect(assets.length).toBeGreaterThan(0);
  });

  it('rejects unavailable native runtime references through the generation collaborator', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-authority-'));
    const templatesRoot = nodePath.join(fixture, 'templates');
    cpSync(nodePath.join(packageRoot, 'templates'), templatesRoot, { recursive: true });
    writeFileSync(
      nodePath.join(templatesRoot, 'skills/audit/SKILL.md'),
      'Run `.claude/skills/private-runtime/SKILL.md` from this project.\n',
    );

    try {
      expect(() =>
        generateClaudePluginAssets({
          cliBundle: 'console.log("stub cli bundle");',
          sourceRoot: nodePath.join(packageRoot, 'src'),
          templatesRoot,
          version: '0.0.0-test',
        }),
      ).toThrow('Native plugin assets reference project-local executable runtime');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
