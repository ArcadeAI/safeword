/**
 * Runs the real post-edit hook with deliberately unformatted source. JS/TS
 * fixtures require positive diagnostic output as well as preserved bytes, so
 * a startup failure cannot masquerade as a successful observational check.
 * External formatter ownership and JSON behavior retain their existing scope.
 */

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const POST_TOOL_LINT = nodePath.join(PROJECT_ROOT, '.safeword/hooks/post-tool-lint.ts');
const SESSION_LINT_CHECK = nodePath.join(PROJECT_ROOT, '.safeword/hooks/session-lint-check.ts');
const REPO_NODE_MODULES = nodePath.join(PROJECT_ROOT, 'node_modules');

const SAFEWORD_PRETTIERRC = `${JSON.stringify({ singleQuote: true, semi: true })}\n`;
const DOUBLE_QUOTE_TS = 'export const greeting={ message:"hello world" }\n';
const SINGLE_QUOTE_TS = "export const greeting = 'hello world'\n";
const COMPACT_JSON = '{"a":1}\n';

const FORMATTER_CONFIG_FILE: Record<string, string> = {
  Biome: 'biome.json',
  dprint: 'dprint.json',
  oxfmt: '.oxfmtrc.json',
  deno: 'deno.json',
};

interface FormatterWorld extends SafewordWorld {
  projectDirectory?: string;
  pendingFile?: string;
  fileSeed?: string;
  contentsBefore?: string;
}

function createProject(options: { safewordPrettier?: boolean; biome?: boolean } = {}): string {
  const directory = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-fmt-'));
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword/eslint.config.mjs'),
    `export default [{ files: ['**/*.ts'], rules: { 'no-restricted-syntax': ['error', { selector: 'Program', message: 'fixture-diagnostic' }] } }];\n`,
  );
  if (options.safewordPrettier !== false) {
    writeFileSync(nodePath.join(directory, '.safeword/.prettierrc'), SAFEWORD_PRETTIERRC);
  }
  if (options.biome) {
    // Isolate the external Biome process without writing into shared dependencies.
    // The real hook must invoke this checker and return its diagnostic. Mutation
    // flags intentionally destroy the source, just as in the hook-entry tests.
    const bin = nodePath.join(directory, 'node_modules', '.bin');
    mkdirSync(bin, { recursive: true });
    for (const tool of ['eslint', 'prettier']) {
      symlinkSync(nodePath.join(REPO_NODE_MODULES, '.bin', tool), nodePath.join(bin, tool));
    }
    const biome = nodePath.join(bin, 'biome');
    writeFileSync(
      biome,
      '#!/bin/sh\nfor target in "$@"; do :; done\n[ -f "$target" ] || exit 2\ncase "$*" in *--write*|fix*) echo rewritten > "$target";; esac\necho fixture-diagnostic >&2\nexit 1\n',
    );
    chmodSync(biome, 0o755);
  } else {
    symlinkSync(REPO_NODE_MODULES, nodePath.join(directory, 'node_modules'), 'dir');
  }
  return directory;
}

function projectDir(world: FormatterWorld): string {
  assert.ok(world.projectDirectory, 'project directory was not created');
  return world.projectDirectory;
}

function writeFile(directory: string, name: string, contents: string): void {
  writeFileSync(nodePath.join(directory, name), contents);
}

function runLintHookOn(world: FormatterWorld, name: string): void {
  const directory = projectDir(world);
  const absolute = nodePath.join(directory, name);
  world.pendingFile = name;
  world.contentsBefore = readFileSync(absolute, 'utf8');
  const result = spawnSync('bun', [POST_TOOL_LINT], {
    cwd: directory,
    input: JSON.stringify({ tool_input: { file_path: absolute } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory, SAFEWORD_TEST_DISABLE_AUTO_UPGRADE: '1' },
    encoding: 'utf8',
  });
  assert.equal(result.error, undefined, 'hook process must start');
  assert.equal(result.status, 0, result.stderr);
  if (name.endsWith('.ts')) {
    assert.match(result.stdout, /^\s*\{/u, 'hook must return structured diagnostics');
    const output = JSON.parse(result.stdout) as {
      hookSpecificOutput: { additionalContext: string };
    };
    assert.match(
      output.hookSpecificOutput.additionalContext,
      /fixture-diagnostic/,
      'hook must return a diagnostic from the checker, not a missing-tool warning',
    );
  }
  world.result = {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? -1,
  };
}

function readPending(world: FormatterWorld): string {
  return readFileSync(nodePath.join(projectDir(world), world.pendingFile ?? ''), 'utf8');
}

After(function (this: FormatterWorld) {
  if (this.projectDirectory) rmSync(this.projectDirectory, { recursive: true, force: true });
});

// --- Given: alternative-formatter repos ---------------------------------------

Given('a repo owned by {word} with no Prettier config', function (this: FormatterWorld, formatter) {
  this.projectDirectory = createProject({ biome: formatter === 'Biome' });
  const config = FORMATTER_CONFIG_FILE[formatter as string];
  assert.ok(config, `unknown formatter: ${formatter}`);
  writeFile(this.projectDirectory, config, '{}\n');
});

Given('a Biome repo with no Prettier config', function (this: FormatterWorld) {
  this.projectDirectory = createProject({ biome: true });
  writeFile(this.projectDirectory, 'biome.json', '{}\n');
});

Given('a repo with both a Biome config and a Prettier config', function (this: FormatterWorld) {
  this.projectDirectory = createProject({ biome: true });
  writeFile(this.projectDirectory, 'biome.json', '{}\n');
  writeFile(this.projectDirectory, '.prettierrc', '{}\n');
});

Given('a repo whose formatting is owned by Biome', function (this: FormatterWorld) {
  this.projectDirectory = createProject({ biome: true });
  writeFile(this.projectDirectory, 'biome.json', '{}\n');
});

// --- Given: prettier / greenfield repos ---------------------------------------

Given(
  'a repo with its own Prettier config that uses double quotes',
  function (this: FormatterWorld) {
    // A customer formatter must not rewrite an unfinished post-edit file.
    this.projectDirectory = createProject({ safewordPrettier: false });
    writeFile(this.projectDirectory, '.prettierrc', `${JSON.stringify({ singleQuote: false })}\n`);
    this.fileSeed = SINGLE_QUOTE_TS;
  },
);

Given('a repo with no formatter configuration', function (this: FormatterWorld) {
  this.projectDirectory = createProject();
  this.fileSeed = DOUBLE_QUOTE_TS;
});

Given(
  'a repo whose only Prettier-like file is a disabled ".prettierrc.bak"',
  function (this: FormatterWorld) {
    this.projectDirectory = createProject();
    writeFile(this.projectDirectory, '.prettierrc.bak', '{}\n');
    this.fileSeed = DOUBLE_QUOTE_TS;
  },
);

// --- Given: the file under edit (TB1 scenarios name it explicitly) -----------

Given(
  /^a TypeScript file styled to \w+'s conventions, which differ from Prettier's defaults$/,
  function (this: FormatterWorld) {
    writeFile(projectDir(this), 'greeting.ts', DOUBLE_QUOTE_TS);
    this.pendingFile = 'greeting.ts';
  },
);

Given(
  /^a JSON file styled to Biome's conventions, which differ from Prettier's defaults$/,
  function (this: FormatterWorld) {
    writeFile(projectDir(this), 'data.json', COMPACT_JSON);
    this.pendingFile = 'data.json';
  },
);

// --- When ---------------------------------------------------------------------

When('the agent edits that file', function (this: FormatterWorld) {
  runLintHookOn(this, this.pendingFile ?? 'greeting.ts');
});

When('the agent edits a TypeScript file', function (this: FormatterWorld) {
  writeFile(projectDir(this), 'greeting.ts', this.fileSeed ?? DOUBLE_QUOTE_TS);
  runLintHookOn(this, 'greeting.ts');
});

When('safeword runs its session lint check', function (this: FormatterWorld) {
  const directory = projectDir(this);
  const result = spawnSync('bun', [SESSION_LINT_CHECK], {
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    encoding: 'utf8',
  });
  assert.equal(result.error, undefined, 'session hook process must start');
  assert.equal(result.status, 0, result.stderr);
  this.result = {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? -1,
  };
});

// --- Then ---------------------------------------------------------------------

Then(
  "the file's formatting is left as written, not reformatted to Prettier's defaults",
  function (this: FormatterWorld) {
    assert.equal(readPending(this), this.contentsBefore, 'the hook reformatted the file');
  },
);

Then(
  'it emits no warning that Prettier is missing or should be installed',
  function (this: FormatterWorld) {
    assert.doesNotMatch(this.result.stdout, /prettier/i, 'session check nagged about Prettier');
  },
);
