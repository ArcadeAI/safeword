/**
 * Files safeword scaffolds into a project must pass that project's own lint.
 * A fresh install that fails `eslint .` on safeword's files buries real
 * findings and pushes agents to hand-edit protected config (#6966).
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint, Linter } from 'eslint';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { recommended } from '../src/presets/typescript/eslint-configs/recommended.js';
import { recommendedTypeScript } from '../src/presets/typescript/eslint-configs/recommended-typescript.js';
import { getEslintConfig, getSafewordEslintConfig } from '../src/templates/config.js';

const linter = new Linter({ configType: 'flat' });

// A virtual root inside the package: kebab-case so filename rules pass, and
// inside node resolution of `safeword/eslint` like a real project.
const projectRoot = nodePath.join(import.meta.dirname, 'scaffold-project');

function lintAs(code: string, relativeFilename: string, config: unknown[]): string[] {
  const filename = nodePath.join(projectRoot, relativeFilename);
  return linter
    .verify(code, config as Linter.Config[], { filename })
    .map(
      message =>
        `${message.line}:${message.column} ${message.ruleId ?? 'parse'} ${message.message}`,
    );
}

const cucumberConfig = readFileSync(
  fileURLToPath(new URL('../templates/cucumber/cucumber.mjs', import.meta.url)),
  'utf8',
);

const scaffoldedFiles: [label: string, filename: string, code: string][] = [
  ['root eslint.config.mjs', 'eslint.config.mjs', getEslintConfig(false)],
  ['formatter-agnostic eslint.config.mjs', 'eslint.config.mjs', getEslintConfig(true)],
  ['cucumber.mjs', 'cucumber.mjs', cucumberConfig],
];

describe('scaffolded files lint clean under the preset they install (#6966)', () => {
  it.each(scaffoldedFiles)('%s passes the JavaScript preset', (_label, filename, code) => {
    expect(lintAs(code, filename, recommended)).toEqual([]);
  });

  it.each(scaffoldedFiles)('%s passes the TypeScript preset', (_label, filename, code) => {
    expect(lintAs(code, filename, recommendedTypeScript)).toEqual([]);
  });

  it('generates the hook config identically before and after the root config exists', () => {
    // Setup writes the root config in the same run, so the hook config must not
    // depend on whether it existed yet, or a second identical install changes it.
    expect(getSafewordEslintConfig(undefined, false)).toBe(
      getSafewordEslintConfig('eslint.config.mjs', false),
    );
  });
});

describe('ESLint 10 never lints vendored .safeword files (#6966)', () => {
  // A real project on disk, inside the package so `eslint` resolves. The hook
  // config is the formatter-agnostic variant so it imports nothing but eslint.
  const project = mkdtempSync(nodePath.join(import.meta.dirname, 'vendored-ignore-'));
  const violation = 'var unused = 1;\n';
  writeFileSync(
    nodePath.join(project, 'eslint.config.mjs'),
    "export default [{ rules: { 'no-var': 'error' } }];\n",
  );
  mkdirSync(nodePath.join(project, '.safeword/hooks'), { recursive: true });
  writeFileSync(
    nodePath.join(project, '.safeword/eslint.config.mjs'),
    getSafewordEslintConfig(undefined, true),
  );
  writeFileSync(nodePath.join(project, '.safeword/hooks/vendored.mjs'), violation);
  mkdirSync(nodePath.join(project, 'src'));
  writeFileSync(nodePath.join(project, 'src/app.mjs'), violation);
  afterAll(() => {
    rmSync(project, { recursive: true, force: true });
  });

  async function reportedFiles(options: ESLint.Options): Promise<string[]> {
    const results = await new ESLint({ cwd: project, ...options }).lintFiles(['.']);
    return results
      .filter(result => result.errorCount > 0)
      .map(result => nodePath.relative(project, result.filePath))
      .toSorted((left, right) => left.localeCompare(right));
  }

  it('skips them under nearest-config lookup while still linting project code', async () => {
    expect(await reportedFiles({})).toEqual(['src/app.mjs']);
  });

  it('skips them when the hook passes --config, which still lints project code', async () => {
    expect(await reportedFiles({ overrideConfigFile: '.safeword/eslint.config.mjs' })).toEqual([
      'src/app.mjs',
    ]);
  });
});

describe('cucumber step definitions register at import time', () => {
  const stepsRoot = `${import.meta.dirname}/`;
  const projectLinter = new Linter({ configType: 'flat', cwd: stepsRoot });
  const worldModule = [
    "import { setWorldConstructor, World } from '@cucumber/cucumber';",
    '',
    'export class ProjectWorld extends World {}',
    '',
    'setWorldConstructor(ProjectWorld);',
    '',
  ].join('\n');
  const sideEffectFindings = (relativeFilename: string) =>
    projectLinter
      .verify(worldModule, recommended as Linter.Config[], {
        filename: `${stepsRoot}${relativeFilename}`,
      })
      .filter(message => message.ruleId === 'unicorn/no-top-level-side-effects');

  it('allows top-level runner calls in exported step modules', () => {
    expect(sideEffectFindings('steps/world.mjs')).toEqual([]);
    expect(sideEffectFindings('packages/app/features/steps/world.mjs')).toEqual([]);
  });

  it('still flags the same pattern in application code', () => {
    expect(sideEffectFindings('src/world.mjs')).not.toEqual([]);
  });

  it.each([
    ['the project root', '', 'acceptance/definitions'],
    ['a project subfolder', 'acceptance', 'acceptance/definitions'],
    // ESLint normalizes a leading ./ and a trailing / in files patterns.
    ['the project root with a ./ prefix', '', './acceptance/definitions/'],
  ])(
    'allows them in a lane relocated with paths.steps, run from %s (D16BY4)',
    async (_where, subfolder, configuredSteps) => {
      const project = mkdtempSync(nodePath.join(import.meta.dirname, 'relocated-lane-'));
      try {
        mkdirSync(nodePath.join(project, '.safeword'));
        writeFileSync(
          nodePath.join(project, '.safeword', 'config.json'),
          JSON.stringify({ paths: { steps: configuredSteps } }),
        );
        // The preset reads the lane location when ESLint loads it in the project.
        vi.resetModules();
        mkdirSync(nodePath.join(project, 'acceptance'), { recursive: true });
        const cwd = vi.spyOn(process, 'cwd').mockReturnValue(nodePath.join(project, subfolder));
        const { recommended: projectPreset } =
          await import('../src/presets/typescript/eslint-configs/recommended.js');
        cwd.mockRestore();

        const projectLinterForLane = new Linter({ configType: 'flat', cwd: project });
        const lint = (relativeFilename: string) =>
          projectLinterForLane.verify(worldModule, projectPreset as Linter.Config[], {
            filename: nodePath.join(project, relativeFilename),
          });
        const sideEffects = (messages: Linter.LintMessage[]) =>
          messages.filter(message => message.ruleId === 'unicorn/no-top-level-side-effects');

        const stepMessages = lint('acceptance/definitions/world.mjs');
        // Configured and parsed, not skipped as unmatched.
        expect(stepMessages.filter(message => message.fatal || message.ruleId === null)).toEqual(
          [],
        );
        expect(sideEffects(stepMessages)).toEqual([]);
        // The exemption stays scoped: application code is still flagged.
        expect(sideEffects(lint('src/world.mjs'))).not.toEqual([]);
      } finally {
        rmSync(project, { recursive: true, force: true });
      }
    },
  );
});
