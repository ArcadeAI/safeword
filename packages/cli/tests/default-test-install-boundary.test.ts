import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const CLI_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CONFIG_ONLY_TEST_FILES = [
  'tests/commands/setup-cursor.test.ts',
  'tests/commands/setup-git.test.ts',
  'tests/commands/setup-hooks.test.ts',
  'tests/commands/setup-templates.test.ts',
  'tests/integration/conditional-setup.test.ts',
  'tests/integration/invisible-extension.test.ts',
];

describe('default test install boundary', () => {
  it.each(CONFIG_ONLY_TEST_FILES)('%s uses the explicit no-install CLI helper', relativePath => {
    const source = readFileSync(nodePath.join(CLI_ROOT, relativePath), 'utf8');

    expect(source).toContain('runCliWithoutInstall');
    expect(source).not.toMatch(/\brunCli(Sync)?\(/);
  });

  it('keeps the non-git dependency installation proof in the slow lane', () => {
    const defaultSource = readFileSync(
      nodePath.join(CLI_ROOT, 'tests/integration/conditional-setup.test.ts'),
      'utf8',
    );
    const slowSource = readFileSync(
      nodePath.join(CLI_ROOT, 'tests/integration/conditional-setup.slow.test.ts'),
      'utf8',
    );

    expect(defaultSource).not.toContain('installs base dependencies in a non-git directory');
    expect(slowSource).toContain('installs base dependencies in a non-git directory');
    expect(slowSource).toMatch(/\brunCli\(\['setup', '--yes'\]/);
    expect(slowSource).toContain("node_modules', 'eslint', 'package.json");
    expect(slowSource).toContain("node_modules', 'safeword', 'package.json");
  });

  it('runs the focused physical-install proof in CI', () => {
    const packageJson = JSON.parse(
      readFileSync(nodePath.join(CLI_ROOT, 'package.json'), 'utf8'),
    ) as {
      scripts?: Record<string, string>;
    };
    const workflowSource = readFileSync(
      nodePath.resolve(CLI_ROOT, '..', '..', '.github/workflows/ci.yml'),
      'utf8',
    );

    expect(packageJson.scripts?.['test:slow:install-proof']).toContain(
      '--config vitest.slow.config.ts',
    );
    expect(packageJson.scripts?.['test:slow:install-proof']).toContain(
      'conditional-setup.slow.test.ts',
    );
    expect(workflowSource).toContain('bun run --cwd packages/cli test:slow:install-proof');
  });
});
