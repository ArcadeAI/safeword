import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { SAFEWORD_SCHEMA } from '../../src/schema.ts';
import type { SafewordWorld } from './world.js';

// Mirrors the fake Claude host in tests/claude-plugin/profile-install.test.ts,
// driven here through the built CLI instead of installClaudePlugin directly.
const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const REPO_PLUGIN = nodePath.resolve(import.meta.dirname, '../../../../plugin');
const OFFERED_VERSION = '1.1.0';
const MARKETPLACE_URL = 'https://github.com/ArcadeAI/safeword.git';
// installClaudePlugin expects the prerelease-aware ref officialMarketplaceSource() uses.
const MARKETPLACE_REF = SAFEWORD_SCHEMA.version.includes('-')
  ? `v${SAFEWORD_SCHEMA.version}`
  : 'stable';

interface SourceRepoWorld extends SafewordWorld {
  fixtureRoot?: string;
  project?: string;
  claudeLog?: string;
  environment?: NodeJS.ProcessEnv;
}

interface Envelope {
  ok: boolean;
  state: string;
  errors?: { code: string }[];
  findings?: { code: string; severity: string; message: string }[];
  data?: { classification?: string };
}

function json(value: unknown): string {
  return `${JSON.stringify(value, undefined, 2)}\n`;
}

/** A verified native payload whose identity declares `version`, as a release would. */
function releasedPayload(root: string, version: string): string {
  const installPath = nodePath.join(root, 'cached-plugin');
  cpSync(REPO_PLUGIN, installPath, { recursive: true });
  const identityPath = nodePath.join(installPath, 'identity.json');
  const identity = JSON.parse(readFileSync(identityPath, 'utf8')) as Record<string, unknown>;
  writeFileSync(identityPath, json({ ...identity, plugin_version: version }));
  return installPath;
}

/** Claude's config directory: a current marketplace whose checkout offers OFFERED_VERSION. */
function claudeConfig(configDirectory: string): void {
  const checkout = nodePath.join(configDirectory, 'plugins/marketplaces/safeword');
  mkdirSync(nodePath.join(checkout, '.claude-plugin'), { recursive: true });
  writeFileSync(
    nodePath.join(checkout, '.claude-plugin/marketplace.json'),
    json({ name: 'safeword', plugins: [{ name: 'safeword', version: OFFERED_VERSION }] }),
  );
  writeFileSync(
    nodePath.join(configDirectory, 'plugins/known_marketplaces.json'),
    json({
      safeword: {
        source: { source: 'git', url: MARKETPLACE_URL, ref: MARKETPLACE_REF },
        installLocation: checkout,
      },
    }),
  );
  writeFileSync(
    nodePath.join(configDirectory, 'plugins/installed_plugins.json'),
    json({ version: 2, plugins: { 'safeword@safeword': [] } }),
  );
}

function projectSettings(project: string): void {
  mkdirSync(nodePath.join(project, '.claude'), { recursive: true });
  writeFileSync(
    nodePath.join(project, '.claude/settings.json'),
    json({
      env: { CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: '1' },
      extraKnownMarketplaces: {
        safeword: {
          source: { source: 'git', url: MARKETPLACE_URL, ref: MARKETPLACE_REF },
          autoUpdate: true,
        },
      },
    }),
  );
}

/** A `claude` CLI that reports the installed plugin and logs every command it receives. */
function fakeClaude(bin: string, paths: Record<string, string>): void {
  const { installed, installPath, log, project } = paths;
  const executable = nodePath.join(bin, 'claude');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
printf '%s\n' "$*" >> '${log}'
case "$*" in
  '--version') echo '2.1.170' ;;
  'plugin marketplace list --json')
    printf '[{"name":"safeword","source":{"url":"${MARKETPLACE_URL}","ref":"${MARKETPLACE_REF}"}}]\n' ;;
  'plugin list --json')
    printf '[{"id":"safeword@safeword","scope":"project","projectPath":"${project}","version":"%s","enabled":true,"installPath":"${installPath}"}]\n' "$(cat '${installed}')" ;;
  'plugin update safeword@safeword --scope project') printf '${OFFERED_VERSION}\n' > '${installed}' ;;
  *) echo "unexpected claude command: $*" >&2; exit 97 ;;
esac
`,
  );
  chmodSync(executable, 0o755);
}

function createFixture(world: SourceRepoWorld, sourceRepo: boolean, version: string): void {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-source-repo-'));
  const project = nodePath.join(root, 'project');
  const bin = nodePath.join(root, 'bin');
  const configDirectory = nodePath.join(root, 'claude-config');
  mkdirSync(project);
  mkdirSync(bin);
  mkdirSync(nodePath.join(configDirectory, 'plugins'), { recursive: true });
  // isDogfoodRepo recognizes the source repo by its package name.
  writeFileSync(
    nodePath.join(project, 'package.json'),
    json({ name: sourceRepo ? 'safeword' : 'consumer-app' }),
  );
  projectSettings(project);
  claudeConfig(configDirectory);
  const installed = nodePath.join(root, 'installed-version');
  writeFileSync(installed, `${version}\n`);
  const claudeLog = nodePath.join(root, 'claude.log');
  writeFileSync(claudeLog, '');
  fakeClaude(bin, {
    installed,
    installPath: releasedPayload(root, version),
    log: claudeLog,
    project,
  });
  world.fixtureRoot = root;
  world.project = project;
  world.claudeLog = claudeLog;
  world.environment = {
    PATH: `${bin}${nodePath.delimiter}${process.env.PATH ?? ''}`,
    HOME: root,
    LANG: process.env.LANG ?? 'C.UTF-8',
    CLAUDE_CONFIG_DIR: configDirectory,
    CLAUDE_PROJECT_DIR: project,
    SAFEWORD_NO_UPDATE_CHECK: '1',
    SAFEWORD_SKIP_INSTALL: '1',
  };
}

function runCli(world: SourceRepoWorld, arguments_: readonly string[]): Envelope {
  const project = world.project ?? assert.fail('fixture project was not created');
  const completed = spawnSync(
    process.execPath,
    [CLI_PATH, ...arguments_, '--json', '--no-input', '--cwd', project],
    { cwd: project, encoding: 'utf8', env: world.environment },
  );
  world.result = {
    stdout: completed.stdout,
    stderr: completed.stderr,
    exitCode: completed.status ?? 1,
  };
  try {
    return JSON.parse(completed.stdout) as Envelope;
  } catch (error) {
    throw new Error(
      `safeword ${arguments_.join(' ')} did not print a JSON envelope (exit ${completed.status}): ${completed.stderr || completed.stdout}`,
      { cause: error },
    );
  }
}

function installEnvelope(world: SourceRepoWorld): Envelope {
  return JSON.parse(world.result.stdout) as Envelope;
}

function claudeCommands(world: SourceRepoWorld): string {
  return readFileSync(world.claudeLog ?? assert.fail('fake claude was not created'), 'utf8');
}

After(function (this: SourceRepoWorld) {
  if (this.fixtureRoot !== undefined) rmSync(this.fixtureRoot, { recursive: true, force: true });
});

Given(
  'the Safeword source repo with released Claude plugin {string} installed',
  function (this: SourceRepoWorld, version: string) {
    createFixture(this, true, version);
  },
);

Given(
  'the Safeword source repo with Claude plugin {string} installed',
  function (this: SourceRepoWorld, version: string) {
    createFixture(this, true, version);
  },
);

Given(
  'a consumer project with released Claude plugin {string} installed',
  function (this: SourceRepoWorld, version: string) {
    createFixture(this, false, version);
  },
);

When('Safeword is installed for Claude', function (this: SourceRepoWorld) {
  runCli(this, ['install', '--agents=claude']);
});

Then('the install succeeds without an error', function (this: SourceRepoWorld) {
  const envelope = installEnvelope(this);
  // Install also reconciles project configuration, so a first run reports "changed", not "healthy".
  assert.equal(this.result.exitCode, 0, this.result.stdout);
  assert.equal(envelope.ok, true);
  assert.deepEqual(envelope.errors ?? [], []);
});

Then(
  'Safeword explains that Claude uses released plugin {string}',
  function (this: SourceRepoWorld, version: string) {
    const finding = installEnvelope(this).findings?.find(
      candidate => candidate.code === 'CLAUDE_PLUGIN_DOGFOOD_RELEASED',
    );
    assert.ok(finding, this.result.stdout);
    assert.equal(finding.severity, 'info');
    assert.ok(finding.message.includes(`released plugin ${version} `), finding.message);
  },
);

Then('Safeword does not ask Claude to update the plugin', function (this: SourceRepoWorld) {
  assert.doesNotMatch(claudeCommands(this), /plugin update/u);
});

// Positive sibling: without it, "does not ask" would survive an install that never updates.
Then('Safeword asks Claude to update the plugin', function (this: SourceRepoWorld) {
  assert.match(claudeCommands(this), /^plugin update safeword@safeword --scope project$/mu);
});

Then('the install fails with {string}', function (this: SourceRepoWorld, code: string) {
  const envelope = installEnvelope(this);
  assert.equal(this.result.exitCode, 1, this.result.stdout);
  assert.equal(envelope.errors?.[0]?.code, code, this.result.stdout);
});

// Status classifies a plugin "unproven" only after accepting its version: what remains is the
// runtime proof Claude records once the session reloads plugins.
Then('Claude status accepts the installed plugin version', function (this: SourceRepoWorld) {
  const status = runCli(this, ['claude', 'status']);
  assert.equal(status.data?.classification, 'unproven', JSON.stringify(status));
});

Then('Claude status reports the plugin as the wrong version', function (this: SourceRepoWorld) {
  const status = runCli(this, ['claude', 'status']);
  assert.equal(status.data?.classification, 'wrong-version', JSON.stringify(status));
});
