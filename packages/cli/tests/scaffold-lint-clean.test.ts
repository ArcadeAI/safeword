/**
 * Files safeword scaffolds into a project must pass that project's own lint.
 * A fresh install that fails `eslint .` on safeword's files buries real
 * findings and pushes agents to hand-edit protected config (#6966).
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

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

  it('keeps ESLint 10 from linting its own vendored directory', () => {
    // .safeword/ holds vendored hook sources; lint-cleanliness there is not the
    // project's concern, so the hook config ignores the directory instead.
    expect(getSafewordEslintConfig(undefined, false)).toContain(
      '[{ basePath: import.meta.dirname, ignores: ["**"] }]',
    );
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
});
