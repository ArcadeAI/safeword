/**
 * Release gate: shipped TypeScript templates remain valid in their installed shape.
 *
 * Schema-declared templates are copied into customer repositories, where host
 * lint and TypeScript tooling can inspect them. Validate each physical
 * TypeScript template here with Safeword's package-pinned type dependencies;
 * customers may use different dependency versions outside this release contract.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import eslintJs from '@eslint/js';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

import { generateOwnedPathsModule } from '../src/owned-paths.js';
import { recommendedTypeScript } from '../src/presets/typescript/eslint-configs/recommended-typescript.js';
import { SAFEWORD_SCHEMA } from '../src/schema.js';

const cliRoot = nodePath.resolve(import.meta.dirname, '..');
const templatesDirectory = nodePath.join(cliRoot, 'templates');
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

interface InstalledTemplate {
  destinationPath: string;
  templatePath: string;
}

const shippedTypeScriptTemplates: InstalledTemplate[] = [
  ...Object.entries(SAFEWORD_SCHEMA.ownedFiles),
  ...Object.entries(SAFEWORD_SCHEMA.managedFiles),
].flatMap(([destinationPath, definition]) => {
  const templatePath = definition.template;
  return templatePath?.endsWith('.ts') ? [{ destinationPath, templatePath }] : [];
});

function createInstalledTemplatesFixture(): {
  cleanup: () => void;
  directory: string;
  templatePaths: string[];
} {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-shipped-templates-'));
  const templatePaths = shippedTypeScriptTemplates.map(({ destinationPath, templatePath }) => {
    const target = nodePath.join(directory, destinationPath);
    mkdirSync(nodePath.dirname(target), { recursive: true });
    cpSync(nodePath.join(templatesDirectory, templatePath), target);
    return target;
  });
  const ownedPathsTarget = nodePath.join(directory, '.safeword', 'hooks', 'lib', 'owned-paths.ts');
  mkdirSync(nodePath.dirname(ownedPathsTarget), { recursive: true });
  writeFileSync(ownedPathsTarget, generateOwnedPathsModule(SAFEWORD_SCHEMA));
  writeFileSync(
    nodePath.join(directory, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          allowImportingTsExtensions: true,
          baseUrl: directory,
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
          paths: {
            '@cucumber/cucumber': [
              nodePath.join(cliRoot, 'node_modules', '@cucumber', 'cucumber', 'lib', 'index.d.ts'),
            ],
          },
          typeRoots: [nodePath.join(cliRoot, 'node_modules', '@types')],
          types: ['node', 'bun'],
        },
        include: [
          ...shippedTypeScriptTemplates.map(({ destinationPath }) => destinationPath),
          ownedPathsTarget,
        ],
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
    templatePaths,
  };
}

describe('shipped TypeScript templates', () => {
  it('pass Safeword’s supported host ESLint baseline', async () => {
    const fixture = createInstalledTemplatesFixture();
    const eslint = new ESLint({
      cwd: fixture.directory,
      ignore: false,
      overrideConfig: supportedHostBaseline,
      overrideConfigFile: true,
    });

    try {
      const results = await eslint.lintFiles(fixture.templatePaths);
      const errors = results.flatMap(result =>
        result.messages
          .filter(message => message.severity === 2)
          .map(
            message =>
              `${nodePath.relative(fixture.directory, result.filePath)}:${message.line}:${message.ruleId}`,
          ),
      );

      expect(errors).toEqual([]);
    } finally {
      fixture.cleanup();
    }
  });

  it('parses and resolves type information without fatal errors under Safeword’s typed host preset', async () => {
    const fixture = createInstalledTemplatesFixture();
    try {
      const eslint = new ESLint({
        cwd: fixture.directory,
        ignore: false,
        overrideConfig: recommendedTypeScript,
        overrideConfigFile: true,
      });

      const results = await eslint.lintFiles(fixture.templatePaths);
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

  it('typechecks every schema-declared template in its installed shape', () => {
    const fixture = createInstalledTemplatesFixture();
    try {
      const result = spawnSync(tscPath, ['--project', 'tsconfig.json'], {
        cwd: fixture.directory,
        encoding: 'utf8',
      });

      expect(result.error, `failed to spawn ${tscPath}`).toBeUndefined();
      expect(
        result.status,
        `tsc exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      ).toBe(0);
    } finally {
      fixture.cleanup();
    }
  });
});
