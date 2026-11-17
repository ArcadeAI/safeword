/**
 * Files safeword scaffolds into a project must pass that project's own lint.
 * A fresh install that fails `eslint .` on safeword's files buries real
 * findings and pushes agents to hand-edit protected config (#6966).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { Linter } from 'eslint';
import { afterAll, describe, expect, it } from 'vitest';

import { getEslintConfig, getSafewordEslintConfig } from '../../../../templates/config.js';
import { recommended } from '../recommended.js';
import { recommendedTypeScript } from '../recommended-typescript.js';

const linter = new Linter({ configType: 'flat' });

// A real project root, so `.safeword/eslint.config.mjs` resolves `../eslint.config.mjs`.
const projectRoot = mkdtempSync(nodePath.join(import.meta.dirname, 'scaffold-project-'));
writeFileSync(nodePath.join(projectRoot, 'eslint.config.mjs'), 'export default [];\n');
afterAll(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

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
  fileURLToPath(new URL('../../../../../templates/cucumber/cucumber.mjs', import.meta.url)),
  'utf8',
);

const scaffoldedFiles: [label: string, filename: string, code: string][] = [
  ['root eslint.config.mjs', 'eslint.config.mjs', getEslintConfig(false)],
  ['formatter-agnostic eslint.config.mjs', 'eslint.config.mjs', getEslintConfig(true)],
  [
    '.safeword/eslint.config.mjs',
    '.safeword/eslint.config.mjs',
    getSafewordEslintConfig(undefined, false),
  ],
  ['cucumber.mjs', 'cucumber.mjs', cucumberConfig],
];

describe('scaffolded files lint clean under the preset they install (#6966)', () => {
  it.each(scaffoldedFiles)('%s passes the JavaScript preset', (_label, filename, code) => {
    expect(lintAs(code, filename, recommended)).toEqual([]);
  });

  it.each(scaffoldedFiles)('%s passes the TypeScript preset', (_label, filename, code) => {
    expect(lintAs(code, filename, recommendedTypeScript)).toEqual([]);
  });

  it('names no plugin rule when extending a custom project config', () => {
    // Under ESLint 10 nearest-config lookup this file is linted by the project's
    // own config, which may not load eslint-plugin-security.
    expect(getSafewordEslintConfig('eslint.config.mjs', false)).not.toContain('security/');
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
