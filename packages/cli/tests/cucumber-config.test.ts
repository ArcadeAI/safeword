import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');

interface CucumberConfig {
  import: string[];
  paths?: string[];
  tags: string;
}

interface CucumberConfigModule {
  buildCucumberConfig: (argv?: string[]) => CucumberConfig;
  hasCliFeaturePath: (argv?: string[]) => boolean;
}

const CONFIG_SURFACES = [
  ['dogfood config', 'cucumber.mjs'],
  ['template config', 'packages/cli/templates/cucumber/cucumber.mjs'],
] as const;

async function loadConfigModule(relativePath: string): Promise<CucumberConfigModule> {
  const url = pathToFileURL(nodePath.join(REPO_ROOT, relativePath));
  return (await import(url.href)) as CucumberConfigModule;
}

describe('Cucumber config targeted path handling', () => {
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
