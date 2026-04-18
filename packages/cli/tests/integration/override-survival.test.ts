/**
 * Ticket #137: Customer override survival across `safeword upgrade`.
 *
 * For each supported language, verify that a rule override placed in the
 * customer-owned config file is (a) honored by the LLM hook lint run and
 * (b) not mutated by `safeword upgrade`.
 *
 * See `.safeword-project/tickets/137-customer-override-survival/test-definitions.md`
 * for the full Gherkin spec.
 */

import { realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createPythonProject,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  isRuffInstalled,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  runLintHook,
  TIMEOUT_BUN_INSTALL,
  writeTestFile,
} from '../helpers';

function applyOverride(existingConfig: string, overrideBlock: string): string {
  // Insert override just before the closing `]);` so it wins over safeword's presets.
  // Flat config is "later wins" — FAQ recommends customer overrides go at the end.
  return existingConfig.replace(/\n\]\);\s*$/, `\n${overrideBlock}]);\n`);
}

async function runUpgradeAndAssertFileUnchanged(
  projectDirectory: string,
  relativePath: string,
): Promise<void> {
  const before = readTestFile(projectDirectory, relativePath);
  await runCli(['upgrade'], { cwd: projectDirectory });
  const after = readTestFile(projectDirectory, relativePath);
  expect(after).toBe(before);
}

function runHookAndGetOutput(projectDirectory: string, violationRelativePath: string): string {
  const violationPath = nodePath.join(projectDirectory, violationRelativePath);
  const hookResult = runLintHook(projectDirectory, violationPath);
  return `${hookResult.stdout ?? ''}${hookResult.stderr ?? ''}`;
}

describe('Customer override survival (#137)', () => {
  describe('Rule: TypeScript overrides in eslint.config.mjs', () => {
    let projectDirectory: string;
    let originalConfig: string;

    beforeAll(async () => {
      // Canonicalize to avoid macOS /var/folders vs /private/var/folders symlink issues
      // that make ESLint ignore absolute-path inputs with "outside of base path" warning.
      projectDirectory = realpathSync(createTemporaryDirectory());
      createTypeScriptPackageJson(projectDirectory);
      initGitRepo(projectDirectory);
      await runCli(['setup', '--yes'], { cwd: projectDirectory });
      originalConfig = readTestFile(projectDirectory, 'eslint.config.mjs');
    }, TIMEOUT_BUN_INSTALL);

    afterAll(() => {
      if (projectDirectory) removeTemporaryDirectory(projectDirectory);
    });

    beforeEach(() => {
      writeTestFile(projectDirectory, 'eslint.config.mjs', originalConfig);
    });

    it(
      'Scenario 1.1: disable-rule override persists through upgrade and hook honors it',
      async () => {
        const overrideBlock = `  {
    name: 'test-customer-override',
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
`;
        writeTestFile(
          projectDirectory,
          'eslint.config.mjs',
          applyOverride(originalConfig, overrideBlock),
        );
        writeTestFile(
          projectDirectory,
          'src/violation-1-1.ts',
          `import { readFileSync } from 'node:fs';
export function loadUserFile(userPath: string): string {
  return readFileSync(userPath, 'utf8');
}
`,
        );

        await runUpgradeAndAssertFileUnchanged(projectDirectory, 'eslint.config.mjs');

        const hookOutput = runHookAndGetOutput(projectDirectory, 'src/violation-1-1.ts');
        expect(hookOutput).not.toContain('security/detect-non-literal-fs-filename');
      },
      TIMEOUT_BUN_INSTALL,
    );

    it(
      'Scenario 1.2: change-threshold override persists through upgrade and hook honors it',
      async () => {
        const overrideBlock = `  {
    name: 'test-customer-override',
    rules: {
      complexity: ['error', 50],
    },
  },
`;
        writeTestFile(
          projectDirectory,
          'eslint.config.mjs',
          applyOverride(originalConfig, overrideBlock),
        );
        writeTestFile(
          projectDirectory,
          'src/violation-1-2.ts',
          `export function classify(n: number): string {
  if (n === 1) return 'a';
  if (n === 2) return 'b';
  if (n === 3) return 'c';
  if (n === 4) return 'd';
  if (n === 5) return 'e';
  if (n === 6) return 'f';
  if (n === 7) return 'g';
  if (n === 8) return 'h';
  if (n === 9) return 'i';
  if (n === 10) return 'j';
  if (n === 11) return 'k';
  if (n === 12) return 'l';
  if (n === 13) return 'm';
  return 'z';
}
`,
        );

        await runUpgradeAndAssertFileUnchanged(projectDirectory, 'eslint.config.mjs');

        const hookOutput = runHookAndGetOutput(projectDirectory, 'src/violation-1-2.ts');
        expect(hookOutput).not.toContain('has a complexity of');
      },
      TIMEOUT_BUN_INSTALL,
    );

    it(
      'Scenario 1.3: add-new-rule override persists through upgrade and hook honors it',
      async () => {
        const overrideBlock = `  {
    name: 'test-customer-override',
    rules: {
      'no-console': 'error',
    },
  },
`;
        writeTestFile(
          projectDirectory,
          'eslint.config.mjs',
          applyOverride(originalConfig, overrideBlock),
        );
        writeTestFile(
          projectDirectory,
          'src/violation-1-3.ts',
          `export function debugLog(message: string): void {
  console.log(message);
}
`,
        );

        await runUpgradeAndAssertFileUnchanged(projectDirectory, 'eslint.config.mjs');

        const hookOutput = runHookAndGetOutput(projectDirectory, 'src/violation-1-3.ts');
        expect(hookOutput).toContain('no-console');
      },
      TIMEOUT_BUN_INSTALL,
    );
  });

  describe.skipIf(!isRuffInstalled())('Rule: Python overrides in ruff.toml', () => {
    let projectDirectory: string;
    let originalRuffToml: string;

    beforeAll(async () => {
      projectDirectory = realpathSync(createTemporaryDirectory());
      createPythonProject(projectDirectory);
      // Pre-create ruff.toml BEFORE setup so safeword generates .safeword/ruff.toml
      // with `extend = "../ruff.toml"` (inheriting from customer config).
      writeTestFile(
        projectDirectory,
        'ruff.toml',
        `[lint]
select = ["E", "F"]
`,
      );
      initGitRepo(projectDirectory);
      await runCli(['setup', '--yes'], { cwd: projectDirectory });
      originalRuffToml = readTestFile(projectDirectory, 'ruff.toml');
    }, TIMEOUT_BUN_INSTALL);

    afterAll(() => {
      if (projectDirectory) removeTemporaryDirectory(projectDirectory);
    });

    beforeEach(() => {
      writeTestFile(projectDirectory, 'ruff.toml', originalRuffToml);
    });

    it(
      'Scenario 2.1: ignore-rule override persists through upgrade and hook honors it',
      async () => {
        const customerRuff = `${originalRuffToml.trim()}
ignore = ["E501"]
`;
        writeTestFile(projectDirectory, 'ruff.toml', customerRuff);
        const longLine = `x = "${'a'.repeat(150)}"`;
        writeTestFile(projectDirectory, 'src/violation_2_1.py', `${longLine}\n`);

        await runUpgradeAndAssertFileUnchanged(projectDirectory, 'ruff.toml');

        const hookOutput = runHookAndGetOutput(projectDirectory, 'src/violation_2_1.py');
        expect(hookOutput).not.toContain('E501');
      },
      TIMEOUT_BUN_INSTALL,
    );

    it(
      'Scenario 2.2: per-file-ignores override persists through upgrade and hook honors it',
      async () => {
        const customerRuff = `${originalRuffToml.trim()}

[lint.per-file-ignores]
"tests/**" = ["S101"]
`;
        writeTestFile(projectDirectory, 'ruff.toml', customerRuff);
        writeTestFile(
          projectDirectory,
          'tests/violation_2_2.py',
          `def test_foo():
    assert 1 == 1
`,
        );

        await runUpgradeAndAssertFileUnchanged(projectDirectory, 'ruff.toml');

        const hookOutput = runHookAndGetOutput(projectDirectory, 'tests/violation_2_2.py');
        expect(hookOutput).not.toContain('S101');
      },
      TIMEOUT_BUN_INSTALL,
    );

    it(
      'Scenario 2.3: extend-select (add new rule) override persists through upgrade and hook honors it',
      async () => {
        const customerRuff = `${originalRuffToml.trim()}
extend-select = ["D"]
`;
        writeTestFile(projectDirectory, 'ruff.toml', customerRuff);
        writeTestFile(
          projectDirectory,
          'src/violation_2_3.py',
          `def undocumented_function(x):
    return x + 1
`,
        );

        await runUpgradeAndAssertFileUnchanged(projectDirectory, 'ruff.toml');

        const hookOutput = runHookAndGetOutput(projectDirectory, 'src/violation_2_3.py');
        expect(hookOutput).toContain('D103');
      },
      TIMEOUT_BUN_INSTALL,
    );
  });
});
