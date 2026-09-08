import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from './helpers';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');
const AUTOMATED_TAGS = 'not @wip and not @proof.vitest and not @manual and not @live';

interface CucumberConfig {
  import: string[];
  paths?: string[];
  tags: string;
}

interface CucumberConfigModule {
  buildCucumberConfig: (argv?: string[]) => CucumberConfig;
  hasCliFeaturePath: (argv?: string[]) => boolean;
}

// The shipped runner template, repo-relative. Single source for both the
// surface matrix below and the configured-directory block near the bottom.
const TEMPLATE_CONFIG_PATH = 'packages/cli/templates/cucumber/cucumber.mjs';

const CONFIG_SURFACES = [
  ['dogfood config', 'cucumber.mjs'],
  ['template config', TEMPLATE_CONFIG_PATH],
] as const;

async function loadConfigModule(relativePath: string): Promise<CucumberConfigModule> {
  const url = pathToFileURL(nodePath.join(REPO_ROOT, relativePath));
  return (await import(url.href)) as CucumberConfigModule;
}

describe('Cucumber config targeted path handling', () => {
  it('keeps the package-local BDD lane complete for Cucumber and Vitest-backed features', () => {
    const cliPackageJson = JSON.parse(
      readFileSync(nodePath.join(REPO_ROOT, 'packages/cli/package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };

    expect(cliPackageJson.scripts?.['test:bdd']).toBe(
      'bun run test:bdd:acceptance && bun run test:bdd:proof',
    );
    expect(cliPackageJson.scripts?.['test:bdd:acceptance']).toContain('cucumber-js');
    expect(cliPackageJson.scripts?.['test:bdd:proof']).toContain('tests/bdd-proof-tags.test.ts');
  });

  it('loads TypeScript step definitions in both deterministic and live dogfood lanes', () => {
    const packageJson = JSON.parse(
      readFileSync(nodePath.join(REPO_ROOT, 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.['test:bdd:acceptance']).toContain("NODE_OPTIONS='--import tsx'");
    expect(packageJson.scripts?.['test:bdd:live']).toContain("NODE_OPTIONS='--import tsx'");
  });

  it('excludes unfinished and separately proven behavior from the automated lane', async () => {
    const packageJson = JSON.parse(
      readFileSync(nodePath.join(REPO_ROOT, 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };
    const cliPackageJson = JSON.parse(
      readFileSync(nodePath.join(REPO_ROOT, 'packages/cli/package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };
    const cliConfig = (await import(
      pathToFileURL(nodePath.join(REPO_ROOT, 'packages/cli/cucumber.mjs')).href
    )) as { default: { tags: string } };

    expect(packageJson.scripts?.['test:bdd:acceptance']).toContain(AUTOMATED_TAGS);
    expect(cliPackageJson.scripts?.['test:bdd:acceptance']).toContain(AUTOMATED_TAGS);
    expect(cliConfig.default.tags).toBe(AUTOMATED_TAGS);
    for (const [, relativePath] of CONFIG_SURFACES) {
      const configModule = await loadConfigModule(relativePath);
      expect(configModule.buildCucumberConfig([]).tags).toBe(AUTOMATED_TAGS);
    }

    expect(AUTOMATED_TAGS).toContain('not @manual');
    expect(AUTOMATED_TAGS).toContain('not @live');
  });

  it.each(CONFIG_SURFACES)(
    '%s includes workspace feature globs when no CLI path is passed',
    async (_label, relativePath) => {
      const { buildCucumberConfig } = await loadConfigModule(relativePath);

      expect(buildCucumberConfig(['--tags', 'not @manual']).paths).toEqual([
        'features/**/*.feature',
        'packages/*/features/**/*.feature',
        'apps/*/features/**/*.feature',
        'libs/*/features/**/*.feature',
        'modules/*/features/**/*.feature',
      ]);
    },
  );

  it.each(CONFIG_SURFACES)(
    '%s omits configured paths when CLI feature path is passed',
    async (_label, relativePath) => {
      const { buildCucumberConfig } = await loadConfigModule(relativePath);

      expect(
        buildCucumberConfig(['features/configure-audit-doc-sources.feature']),
      ).not.toHaveProperty('paths');
    },
  );

  it.each(CONFIG_SURFACES)(
    '%s treats flags as options, not feature paths',
    async (_label, relativePath) => {
      const { hasCliFeaturePath } = await loadConfigModule(relativePath);

      expect(hasCliFeaturePath(['--tags', '@configure-audit-doc-sources.MA1.AC1'])).toBe(false);
    },
  );

  it.each(CONFIG_SURFACES)(
    '%s does not treat option values under features/ as feature paths',
    async (_label, relativePath) => {
      const { hasCliFeaturePath } = await loadConfigModule(relativePath);

      expect(hasCliFeaturePath(['--import', 'features/support.ts'])).toBe(false);
    },
  );
});

// A relocated lane (`paths.features` in .safeword/config.json) run directly as
// `cucumber-js <that dir>` must let the CLI arg win — the configured directory
// counts as a CLI feature path, so config.paths is not merged on top of it
// (issue #710). Exercised against the shipped template loaded next to a real
// config file, since the runner reads config relative to its own location.
describe('Cucumber config configured-directory CLI arg (#710)', () => {
  let directory: string;

  async function loadWithConfiguredFeatures(
    featuresDirectory: string,
  ): Promise<CucumberConfigModule> {
    const template = readFileSync(nodePath.join(REPO_ROOT, TEMPLATE_CONFIG_PATH), 'utf8');
    writeTestFile(directory, 'cucumber.mjs', template);
    writeTestFile(
      directory,
      '.safeword/config.json',
      JSON.stringify({ paths: { features: featuresDirectory } }, undefined, 2),
    );
    const url = pathToFileURL(nodePath.join(directory, 'cucumber.mjs'));
    return (await import(url.href)) as CucumberConfigModule;
  }

  beforeEach(() => {
    directory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(directory);
  });

  it('treats the configured features directory as a CLI feature path', async () => {
    const { hasCliFeaturePath } = await loadWithConfiguredFeatures('tests/behaviors');
    expect(hasCliFeaturePath(['tests/behaviors'])).toBe(true);
  });

  it('treats the configured directory first segment as a CLI feature path', async () => {
    const { hasCliFeaturePath } = await loadWithConfiguredFeatures('tests/behaviors');
    expect(hasCliFeaturePath(['tests'])).toBe(true);
  });

  it('omits config.paths when the configured directory is passed as the CLI arg', async () => {
    const { buildCucumberConfig } = await loadWithConfiguredFeatures('tests/behaviors');
    expect(buildCucumberConfig(['tests/behaviors'])).not.toHaveProperty('paths');
  });
});
