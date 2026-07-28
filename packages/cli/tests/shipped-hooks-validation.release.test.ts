/**
 * Release gate: shipped TypeScript hooks remain valid in the installed shape.
 *
 * Hook templates are copied into customer repositories, where both host lint
 * and TypeScript tooling can inspect them. Validate the entire physical hook
 * tree here without requiring a customer project's dependencies or generated
 * files.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

import { generateOwnedPathsModule } from '../src/owned-paths.js';
import { recommendedTypeScript } from '../src/presets/typescript/eslint-configs/recommended-typescript.js';
import { SAFEWORD_SCHEMA } from '../src/schema.js';

const cliRoot = nodePath.resolve(import.meta.dirname, '..');
const hooksDirectory = nodePath.join(cliRoot, 'templates', 'hooks');
const tscPath = nodePath.join(cliRoot, 'node_modules', '.bin', 'tsc');

// The public baseline that host projects use for distributed hook files. Keep
// this intentionally small: the full Safeword preset has policy rules that
// predate the existing template corpus; this release gate owns distributable
// syntax/type validity, not a repository-wide style migration.
const supportedHostBaseline = [
  eslintJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

function createInstalledHooksFixture(): { cleanup: () => void; directory: string } {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-shipped-hooks-'));
  const fixtureHooksDirectory = nodePath.join(directory, 'hooks');
  cpSync(hooksDirectory, fixtureHooksDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(fixtureHooksDirectory, 'lib', 'owned-paths.ts'),
    generateOwnedPathsModule(SAFEWORD_SCHEMA),
  );
  writeFileSync(
    nodePath.join(directory, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          allowImportingTsExtensions: true,
          module: 'Preserve',
          moduleDetection: 'force',
          moduleResolution: 'bundler',
          noEmit: true,
          noFallthroughCasesInSwitch: true,
          noImplicitOverride: true,
          noUncheckedIndexedAccess: true,
          noUnusedLocals: false,
          noUnusedParameters: false,
          skipLibCheck: true,
          strict: true,
          target: 'ESNext',
          typeRoots: [nodePath.join(cliRoot, 'node_modules', '@types')],
          types: ['node', 'bun'],
        },
        include: ['hooks/**/*.ts'],
      },
      undefined,
      2,
    )}\n`,
  );
  return {
    cleanup: () => {
      rmSync(directory, { force: true, maxRetries: 3, recursive: true });
    },
    directory,
  };
}

describe('shipped TypeScript hooks', () => {
  it('pass Safeword’s supported host ESLint baseline', async () => {
    const eslint = new ESLint({
      cwd: cliRoot,
      ignore: false,
      overrideConfig: supportedHostBaseline,
      overrideConfigFile: true,
    });

    const results = await eslint.lintFiles([hooksDirectory]);
    const errors = results.flatMap(result =>
      result.messages
        .filter(message => message.severity === 2)
        .map(
          message =>
            `${nodePath.relative(cliRoot, result.filePath)}:${message.line}:${message.ruleId}`,
        ),
    );

    expect(errors).toEqual([]);
  });

  it('loads every installed hook through Safeword’s actual typed host preset', async () => {
    const fixture = createInstalledHooksFixture();
    try {
      const eslint = new ESLint({
        cwd: fixture.directory,
        ignore: false,
        overrideConfig: recommendedTypeScript,
        overrideConfigFile: true,
      });

      const results = await eslint.lintFiles(['hooks']);
      const fatalErrors = results.flatMap(result =>
        result.messages
          .filter(message => message.fatal)
          .map(
            message =>
              `${nodePath.relative(fixture.directory, result.filePath)}:${message.line}:${message.ruleId}`,
          ),
      );

      expect(fatalErrors).toEqual([]);
    } finally {
      fixture.cleanup();
    }
  }, 30_000);

  it('typechecks every template in its installed shape', () => {
    const fixture = createInstalledHooksFixture();
    try {
      const result = spawnSync(tscPath, ['--project', 'tsconfig.json'], {
        cwd: fixture.directory,
        encoding: 'utf8',
      });

      expect(
        result.status,
        `tsc exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      ).toBe(0);
    } finally {
      fixture.cleanup();
    }
  });
});
import eslintJs from '@eslint/js';
