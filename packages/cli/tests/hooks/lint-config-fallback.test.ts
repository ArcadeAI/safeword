import { execFile } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const LINT_MODULES = [
  {
    moduleName: 'shipped template',
    modulePath: path.resolve(__dirname, '../../templates/hooks/lib/lint.ts'),
  },
  {
    moduleName: 'dogfood hook',
    modulePath: path.resolve(REPO_ROOT, '.safeword/hooks/lib/lint.ts'),
  },
];
const LANGUAGE_CASES = [
  {
    languageName: 'TypeScript',
    extension: 'ts',
    configRelativePath: undefined,
    expectedWarning:
      'TypeScript Safeword config is missing — linting with ESLint defaults, not Safeword rules. Run `safeword setup` to install it.',
    forbidConfigArgument: true,
    stubCommands: [],
    expectedInvocations: [
      /^bunx eslint --fix .*source\.ts$/,
      /^bunx eslint .*source\.ts$/,
      /^bunx prettier --write .*source\.ts$/,
    ],
  },
  {
    languageName: 'configured TypeScript',
    extension: 'ts',
    configRelativePath: '.safeword/eslint.config.mjs',
    expectedWarning: undefined,
    forbidConfigArgument: false,
    stubCommands: [],
    expectedInvocations: [
      /^bunx eslint --config .*\/\.safeword\/eslint\.config\.mjs --fix .*source\.ts$/,
      /^bunx eslint --config .*\/\.safeword\/eslint\.config\.mjs .*source\.ts$/,
      /^bunx prettier --write .*source\.ts$/,
    ],
  },
  {
    languageName: 'Python',
    extension: 'py',
    configRelativePath: undefined,
    expectedWarning:
      'Python Safeword config is missing — linting with Ruff defaults, not Safeword rules. Run `safeword setup` to install it.',
    forbidConfigArgument: true,
    stubCommands: ['ruff'],
    expectedInvocations: [
      /^ruff check --fix .*source\.py$/,
      /^ruff format .*source\.py$/,
      /^ruff check .*source\.py$/,
    ],
  },
  {
    languageName: 'configured Python',
    extension: 'py',
    configRelativePath: '.safeword/ruff.toml',
    expectedWarning: undefined,
    forbidConfigArgument: false,
    stubCommands: ['ruff'],
    expectedInvocations: [
      /^ruff check --config .*\/\.safeword\/ruff\.toml --fix .*source\.py$/,
      /^ruff format --config .*\/\.safeword\/ruff\.toml .*source\.py$/,
      /^ruff check --config .*\/\.safeword\/ruff\.toml .*source\.py$/,
    ],
  },
  {
    languageName: 'Go',
    extension: 'go',
    configRelativePath: undefined,
    expectedWarning:
      'Go Safeword config is missing — linting with golangci-lint defaults, not Safeword rules. Run `safeword setup` to install it.',
    forbidConfigArgument: true,
    stubCommands: ['golangci-lint'],
    expectedInvocations: [
      /^golangci-lint version --short$/,
      /^golangci-lint run --fix .*source\.go$/,
      /^golangci-lint fmt .*source\.go$/,
      /^golangci-lint run .*source\.go$/,
    ],
  },
  {
    languageName: 'configured Go',
    extension: 'go',
    configRelativePath: '.safeword/.golangci.yml',
    expectedWarning: undefined,
    forbidConfigArgument: false,
    stubCommands: ['golangci-lint'],
    expectedInvocations: [
      /^golangci-lint version --short$/,
      /^golangci-lint run --config .*\/\.safeword\/\.golangci\.yml --fix .*source\.go$/,
      /^golangci-lint fmt --config .*\/\.safeword\/\.golangci\.yml .*source\.go$/,
      /^golangci-lint run --config .*\/\.safeword\/\.golangci\.yml .*source\.go$/,
    ],
  },
  {
    languageName: 'Rust',
    extension: 'rs',
    configRelativePath: undefined,
    expectedWarning:
      'Rust Safeword config is missing — linting with rustfmt defaults, not Safeword rules. Run `safeword setup` to install it.',
    forbidConfigArgument: true,
    stubCommands: ['rustfmt'],
    expectedInvocations: [/^rustfmt .*source\.rs$/],
  },
  {
    languageName: 'configured Rust',
    extension: 'rs',
    configRelativePath: '.safeword/rustfmt.toml',
    expectedWarning: undefined,
    forbidConfigArgument: false,
    stubCommands: ['rustfmt'],
    expectedInvocations: [/^rustfmt --config-path .*\/\.safeword\/rustfmt\.toml .*source\.rs$/],
  },
  {
    languageName: 'SQL',
    extension: 'sql',
    configRelativePath: undefined,
    expectedWarning: undefined,
    forbidConfigArgument: true,
    stubCommands: [],
    expectedInvocations: [],
  },
  {
    languageName: 'configured SQL',
    extension: 'sql',
    configRelativePath: '.safeword/sqlfluff.cfg',
    expectedWarning: undefined,
    forbidConfigArgument: false,
    stubCommands: ['sqlfluff'],
    expectedInvocations: [/^sqlfluff lint --config .*\/\.safeword\/sqlfluff\.cfg .*source\.sql$/],
  },
];
const LINT_CASES = LINT_MODULES.flatMap(lintModule =>
  LANGUAGE_CASES.map(languageCase => ({ ...lintModule, ...languageCase })),
);

describe('lintFile language-pack config ownership', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories) {
      rmSync(directory, { recursive: true, force: true });
    }
    directories.length = 0;
  });

  it.each(LINT_CASES)(
    '$moduleName keeps $languageName upgrade and git side effects off the edit path',
    async ({
      configRelativePath,
      extension,
      expectedInvocations,
      expectedWarning,
      forbidConfigArgument,
      modulePath,
      stubCommands,
    }) => {
      const directory = mkdtempSync(path.join(tmpdir(), 'lint-config-fallback-'));
      directories.push(directory);
      const sourceFile = path.join(directory, `source.${extension}`);
      const stubBin = path.join(directory, 'stub-bin');
      const invocationLog = path.join(directory, 'invocations.log');
      mkdirSync(stubBin);
      writeFileSync(sourceFile, 'export const source = 1;\n');
      if (configRelativePath) {
        const configPath = path.join(directory, configRelativePath);
        mkdirSync(path.dirname(configPath), { recursive: true });
        writeFileSync(configPath, '');
      }

      for (const command of ['bunx', 'git', ...stubCommands]) {
        const stub = path.join(stubBin, command);
        const versionOutput =
          command === 'golangci-lint'
            ? 'if [ "$1 $2" = "version --short" ]; then printf "2.0.0\\n"; fi\n'
            : '';
        writeFileSync(
          stub,
          `#!/bin/sh\nprintf '%s %s\\n' ${JSON.stringify(command)} "$*" >> ${JSON.stringify(invocationLog)}\n${versionOutput}exit 0\n`,
        );
        chmodSync(stub, 0o755);
      }

      const script = `
        const { lintFile } = await import(${JSON.stringify(modulePath)});
        const first = await lintFile(${JSON.stringify(sourceFile)}, ${JSON.stringify(directory)});
        const second = await lintFile(${JSON.stringify(sourceFile)}, ${JSON.stringify(directory)});
        console.log(JSON.stringify({ first, second }));
      `;
      const { stdout } = await execFileAsync('bun', ['-e', script], {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: directory,
          PATH: `${stubBin}${path.delimiter}${process.env.PATH ?? ''}`,
        },
        timeout: 30_000,
      });

      expect(JSON.parse(stdout.trim())).toEqual({
        first: { warnings: expectedWarning ? [expectedWarning] : [] },
        second: { warnings: [] },
      });
      const invocations = existsSync(invocationLog)
        ? readFileSync(invocationLog, 'utf8').trim().split('\n')
        : [];
      if (expectedInvocations.length === 0) {
        expect(invocations).toEqual([]);
      } else {
        expect(invocations).toEqual(
          expect.arrayContaining(
            expectedInvocations.map(pattern => expect.stringMatching(pattern)),
          ),
        );
      }
      const forbiddenSideEffect = [
        /^git /,
        /(?:^| )safeword(?:@| |$)/,
        /(?:^| )upgrade(?: |$)/,
        ...(forbidConfigArgument ? [/(?:^| )--config(?: |$)/] : []),
      ];
      expect(
        invocations.some(invocation =>
          forbiddenSideEffect.some(pattern => pattern.test(invocation)),
        ),
      ).toBe(false);
      if (!configRelativePath) {
        expect(existsSync(path.join(directory, '.safeword'))).toBe(false);
      }
    },
  );
});
