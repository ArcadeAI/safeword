import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { CommandResult, SafewordWorld } from './world.js';

const SAFEWORD_CODEX_PLUGIN_ROOT = nodePath.resolve(
  import.meta.dirname,
  '..',
  'packages/cli/codex-plugin',
);
const SAFEWORD_CLI_PATH = nodePath.resolve(import.meta.dirname, '..', 'packages/cli/dist/cli.js');
const CODEX_TEST_TICKET_ID = 'ABC123';
const REPO_LOCAL_SAFEWORD_SENTINEL = 'REPO LOCAL SAFEWORD SHOULD NOT APPEAR';
const POST_TOOL_GUIDANCE_LINE =
  'Fixture Safe Word guidance: review the generated file before continuing.';
const PROMPT_CONTEXT_LINE =
  'Queued Safe Word prompt context: continue after verifying the ticket ledger.';
const STOP_CONTINUATION_MESSAGE =
  'Fixture Safe Word continuation: finish the queued verification before stopping.';
const SOURCE_CHECKOUT_HOOK_SENTINEL = 'SOURCE CHECKOUT HOOK SHOULD NOT APPEAR';
const TEST_DEFINITIONS_PATCH = `*** Begin Patch
*** Add File: .project/tickets/${CODEX_TEST_TICKET_ID}/test-definitions.md
+# Test Definitions
*** End Patch
`;

interface CodexPluginMigrationWorld extends SafewordWorld {
  codexPluginRepoRoot?: string;
  codexPluginCodexHome?: string;
  codexPluginMarketplaceRoot?: string;
  codexPluginRecordedTree?: string[];
  codexPluginInstallResult?: CommandResult;
  codexPluginInstallSummary?: string;
  codexPluginListResult?: CommandResult;
  codexPluginPromptResult?: CommandResult;
  codexPluginPromptAvailabilitySummary?: string;
  codexPluginInspectedText?: string;
  codexPluginHookResult?: CommandResult;
  codexPluginHookCommands?: string[];
  codexPluginHookContractResults?: CodexHookContractResult[];
  codexPluginMigrationResult?: CommandResult;
  codexPluginUserDataSnapshot?: Record<string, string>;
  codexPluginUserSkillSnapshot?: string;
  codexPluginUserCodexConfigLines?: string[];
  codexPluginPackageRoot?: string;
  codexPluginPackageTarball?: string;
  codexPluginPackageFiles?: string[];
  codexPluginReleaseContractErrors?: string[];
  codexPluginMissingPackagedReference?: string;
  codexPluginLiveSmokeAttempted?: boolean;
  codexPluginRealListBefore?: CommandResult;
  codexPluginRealListAfter?: CommandResult;
}

interface CodexPluginListEntry {
  name?: string;
  marketplaceName?: string;
  installed?: boolean;
  enabled?: boolean;
}

type CodexHookCommandName =
  'post-tool-use' | 'pre-tool-use' | 'session-start' | 'stop' | 'user-prompt-submit';

interface CodexHookContractResult {
  command: string;
  commandName?: CodexHookCommandName;
  fixtureName?: string;
  fixtureInput?: Record<string, unknown>;
  result?: CommandResult;
  errors: string[];
}

function createTemporaryDirectory(prefix: string): string {
  return mkdtempSync(nodePath.join(tmpdir(), prefix));
}

function requirePath(value: string | undefined, label: string): string {
  assert.ok(value, `${label} was not initialized`);
  return value;
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; env?: Record<string, string>; input?: string; timeout?: number },
): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    input: options.input,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: options.timeout ?? 60_000,
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

function collectTree(root: string, relativeDirectory = ''): string[] {
  const absoluteDirectory = nodePath.join(root, relativeDirectory);
  const entries = readdirSync(absoluteDirectory, { withFileTypes: true });
  const collected: string[] = [];

  for (const entry of entries) {
    if (relativeDirectory === '' && entry.name === '.git') continue;

    const relativePath = nodePath.join(relativeDirectory, entry.name);
    collected.push(entry.isDirectory() ? `${relativePath}/` : relativePath);

    if (entry.isDirectory()) {
      collected.push(...collectTree(root, relativePath));
    }
  }

  return collected.sort();
}

function collectMarkdownText(root: string): string {
  if (!existsSync(root)) return '';

  const chunks: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = nodePath.join(root, entry.name);
    if (entry.isDirectory()) {
      chunks.push(collectMarkdownText(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      chunks.push(readFileSync(fullPath, 'utf8'));
    }
  }

  return chunks.join('\n');
}

function collectHookCommands(value: unknown): string[] {
  if (typeof value === 'string') return [];
  if (Array.isArray(value)) return value.flatMap(entry => collectHookCommands(entry));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return [
      ...(typeof record.command === 'string' ? [record.command] : []),
      ...Object.values(record).flatMap(entry => collectHookCommands(entry)),
    ];
  }

  return [];
}

function requirePackageFiles(world: CodexPluginMigrationWorld): string[] {
  assert.ok(world.codexPluginPackageFiles, 'package files were not inspected');
  return world.codexPluginPackageFiles;
}

function readTarballFile(tarball: string, packagePath: string): string {
  const result = runCommand('tar', ['-xOf', tarball, packagePath], {
    cwd: nodePath.dirname(tarball),
  });
  assert.equal(result.exitCode, 0, result.stderr);
  return result.stdout;
}

function listTarballFiles(tarball: string): string[] {
  const listResult = runCommand('tar', ['-tf', tarball], {
    cwd: nodePath.dirname(tarball),
  });
  assert.equal(listResult.exitCode, 0, listResult.stderr);
  return listResult.stdout.split(/\r?\n/u).filter(Boolean).sort();
}

function inspectReleaseContract(world: CodexPluginMigrationWorld): string[] {
  const errors: string[] = [];
  const files = requirePackageFiles(world);
  const tarball = requirePath(world.codexPluginPackageTarball, 'package tarball');

  for (const requiredPath of [
    'package/codex-plugin/.codex-plugin/plugin.json',
    'package/codex-plugin/hooks.json',
    'package/codex-plugin/skills/bdd/SKILL.md',
    'package/codex-plugin/skills/verify/SKILL.md',
    'package/codex-plugin/skills/explain/SKILL.md',
    'package/dist/cli.js',
  ]) {
    if (!files.includes(requiredPath)) errors.push(`missing packaged reference: ${requiredPath}`);
  }

  if (!files.includes('package/codex-plugin/hooks.json')) return errors;

  const hooksJson = readTarballFile(tarball, 'package/codex-plugin/hooks.json');
  const commands = collectHookCommands(JSON.parse(hooksJson));
  if (commands.length === 0) {
    errors.push('missing packaged hook commands: package/codex-plugin/hooks.json');
  }
  for (const command of commands) {
    if (!/\bsafeword\s+codex-hook\b/u.test(command)) {
      errors.push(`hook command does not invoke packaged entrypoint: ${command}`);
    }
  }

  if (!files.includes('package/dist/cli.js')) return errors;

  const cli = readTarballFile(tarball, 'package/dist/cli.js');
  const codexHookChunks = [
    ...new Set([...cli.matchAll(/\.\/(codex-hook-[A-Z0-9]+\.js)/gu)].map(match => match[1] ?? '')),
  ].filter(Boolean);

  if (codexHookChunks.length === 0) {
    errors.push('missing codex-hook import in package/dist/cli.js');
  }
  for (const chunk of codexHookChunks) {
    const packagedChunk = `package/dist/${chunk}`;
    if (!files.includes(packagedChunk)) {
      errors.push(`missing packaged reference: ${packagedChunk}`);
    }
  }

  return errors;
}

function packSafeWordPackage(): { packageRoot: string; tarball: string } {
  const packageRoot = createTemporaryDirectory('safeword-package-release-contract-');
  const buildResult = runCommand('bun', ['run', 'build'], {
    cwd: nodePath.resolve(import.meta.dirname, '..', 'packages/cli'),
    timeout: 120_000,
  });
  assert.equal(buildResult.exitCode, 0, buildResult.stderr);

  const packResult = runCommand('npm', ['pack', '--json', '--pack-destination', packageRoot], {
    cwd: nodePath.resolve(import.meta.dirname, '..', 'packages/cli'),
    timeout: 120_000,
  });
  assert.equal(packResult.exitCode, 0, packResult.stderr);

  const packed = JSON.parse(packResult.stdout) as Array<{ filename?: string }>;
  const filename = packed[0]?.filename;
  assert.ok(filename, `npm pack did not report a filename: ${packResult.stdout}`);

  return { packageRoot, tarball: nodePath.join(packageRoot, filename) };
}

function writeLocalMarketplace(marketplaceRoot: string): void {
  mkdirSync(nodePath.join(marketplaceRoot, '.agents/plugins'), { recursive: true });
  mkdirSync(nodePath.join(marketplaceRoot, 'plugins'), { recursive: true });
  writeFileSync(
    nodePath.join(marketplaceRoot, '.agents/plugins/marketplace.json'),
    `${JSON.stringify(
      {
        name: 'safeword-local',
        interface: { displayName: 'Safe Word Local' },
        plugins: [
          {
            name: 'safeword',
            source: { source: 'local', path: './plugins/safeword' },
            policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
            category: 'Developer Tools',
          },
        ],
      },
      undefined,
      2,
    )}\n`,
  );
}

function prepareMarketplacePlugin(marketplaceRoot: string): CommandResult | undefined {
  if (!existsSync(SAFEWORD_CODEX_PLUGIN_ROOT)) {
    return {
      stdout: '',
      stderr: `Missing packaged Safe Word Codex plugin root: ${SAFEWORD_CODEX_PLUGIN_ROOT}`,
      exitCode: 1,
    };
  }

  cpSync(SAFEWORD_CODEX_PLUGIN_ROOT, nodePath.join(marketplaceRoot, 'plugins/safeword'), {
    recursive: true,
  });

  return undefined;
}

function runCodexPluginCommand(this: CodexPluginMigrationWorld, args: string[]): CommandResult {
  return runCommand('codex', args, {
    cwd: requirePath(this.codexPluginRepoRoot, 'fresh repo root'),
    env: {
      CODEX_HOME: requirePath(this.codexPluginCodexHome, 'isolated CODEX_HOME'),
    },
  });
}

function runRealCodexPluginCommand(cwd: string, args: string[]): CommandResult {
  return runCommand('codex', args, { cwd });
}

function summarizePluginInstallResult(result: CommandResult): string {
  if (result.exitCode === 0) return 'plugin install succeeded';

  const output = `${result.stdout}\n${result.stderr}`;
  if (output.includes('missing plugin.json')) {
    return 'plugin manifest validation failure: missing plugin.json';
  }

  return output;
}

function findSafeWordPlugin(result: CommandResult): CodexPluginListEntry | undefined {
  if (result.exitCode !== 0) return undefined;

  const parsed = JSON.parse(result.stdout) as { installed?: CodexPluginListEntry[] };
  return parsed.installed?.find(
    entry => entry.name === 'safeword' && entry.marketplaceName === 'safeword-local',
  );
}

function summarizePromptAvailability(
  promptResult: CommandResult,
  pluginListResult: CommandResult,
): string {
  if (promptResult.exitCode !== 0) return 'prompt inspection failed';
  if (promptResult.stdout.includes('safeword:bdd')) return 'prompt valid';

  const safewordPlugin = findSafeWordPlugin(pluginListResult);
  if (safewordPlugin?.installed === true && safewordPlugin.enabled === false) {
    return 'plugin disabled';
  }

  return 'plugin unavailable';
}

function installSafeWordCodexPlugin(this: CodexPluginMigrationWorld): void {
  const marketplaceRoot = requirePath(this.codexPluginMarketplaceRoot, 'local marketplace root');
  const marketplacePreparation = prepareMarketplacePlugin(marketplaceRoot);
  if (marketplacePreparation) {
    this.codexPluginInstallResult = marketplacePreparation;
    return;
  }

  const addMarketplaceResult = runCodexPluginCommand.call(this, [
    'plugin',
    'marketplace',
    'add',
    marketplaceRoot,
    '--json',
  ]);
  if (addMarketplaceResult.exitCode !== 0) {
    this.codexPluginInstallResult = addMarketplaceResult;
    return;
  }

  const installResult = runCodexPluginCommand.call(this, [
    'plugin',
    'add',
    'safeword',
    '--marketplace',
    'safeword-local',
    '--json',
  ]);
  this.codexPluginInstallResult = installResult;
  this.codexPluginInstallSummary = summarizePluginInstallResult(installResult);

  if (installResult.exitCode === 0) {
    this.codexPluginListResult = runCodexPluginCommand.call(this, ['plugin', 'list', '--json']);
  }
}

function createIncompleteFeatureTicket(projectRoot: string): void {
  const ticketDirectory = nodePath.join(projectRoot, '.project/tickets', CODEX_TEST_TICKET_ID);
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    [
      '---',
      `id: ${CODEX_TEST_TICKET_ID}`,
      'type: feature',
      'phase: define-behavior',
      'status: in_progress',
      '---',
      '',
    ].join('\n'),
  );
}

function createCompleteFeatureTicket(projectRoot: string): void {
  const ticketDirectory = nodePath.join(projectRoot, '.project/tickets', CODEX_TEST_TICKET_ID);
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    [
      '---',
      `id: ${CODEX_TEST_TICKET_ID}`,
      'type: feature',
      'phase: define-behavior',
      'status: in_progress',
      'scope:',
      '  - prove packaged Codex PreToolUse allows completed intake edits',
      'out_of_scope:',
      '  - exercising non-Codex hook runtimes',
      'done_when:',
      '  - the packaged entrypoint returns silent allow output',
      '---',
      '',
    ].join('\n'),
  );
}

function createCodexHookContractFixture(): string {
  const repoRoot = createTemporaryDirectory('safeword-codex-hook-contract-');
  writeFileSync(
    nodePath.join(repoRoot, 'package.json'),
    `${JSON.stringify({ name: 'codex-hook-contract-fixture', version: '1.0.0' }, undefined, 2)}\n`,
  );

  const initResult = runCommand('git', ['init', '--quiet'], { cwd: repoRoot });
  assert.equal(initResult.exitCode, 0, initResult.stderr);

  createIncompleteFeatureTicket(repoRoot);
  mkdirSync(nodePath.join(repoRoot, '.project'), { recursive: true });
  writeFileSync(
    nodePath.join(repoRoot, '.project/codex-post-tool-guidance.txt'),
    `${POST_TOOL_GUIDANCE_LINE}\n`,
  );
  writeFileSync(
    nodePath.join(repoRoot, '.project/codex-prompt-context.txt'),
    `${PROMPT_CONTEXT_LINE}\n`,
  );
  writeFileSync(
    nodePath.join(repoRoot, '.project/codex-stop-continuation.txt'),
    `${STOP_CONTINUATION_MESSAGE}\n`,
  );
  mkdirSync(nodePath.join(repoRoot, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(repoRoot, '.safeword/SAFEWORD.md'), REPO_LOCAL_SAFEWORD_SENTINEL);
  mkdirSync(nodePath.join(repoRoot, 'packages/cli/templates/hooks/codex'), { recursive: true });
  writeFileSync(
    nodePath.join(repoRoot, 'packages/cli/templates/hooks/codex/post-tool-quality.ts'),
    SOURCE_CHECKOUT_HOOK_SENTINEL,
  );

  return repoRoot;
}

function readUserDataSnapshot(projectRoot: string): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const relativePath of [
    '.project/tickets/USER123/ticket.md',
    '.project/learnings/user-learning.md',
  ]) {
    snapshot[relativePath] = readFileSync(nodePath.join(projectRoot, relativePath), 'utf8');
  }
  return snapshot;
}

function createProjectLocalCodexInstallFixture(): string {
  const repoRoot = createTemporaryDirectory('safeword-codex-migration-repo-');
  writeFileSync(
    nodePath.join(repoRoot, 'package.json'),
    `${JSON.stringify({ name: 'codex-migration-fixture', version: '1.0.0' }, undefined, 2)}\n`,
  );

  const initResult = runCommand('git', ['init', '--quiet'], { cwd: repoRoot });
  assert.equal(initResult.exitCode, 0, initResult.stderr);

  mkdirSync(nodePath.join(repoRoot, '.safeword/hooks/codex'), { recursive: true });
  mkdirSync(nodePath.join(repoRoot, '.agents/skills/bdd'), { recursive: true });
  mkdirSync(nodePath.join(repoRoot, '.agents/skills/verify'), { recursive: true });
  writeFileSync(nodePath.join(repoRoot, '.safeword/version'), '0.67.0\n');
  writeFileSync(
    nodePath.join(repoRoot, '.safeword/config.json'),
    `${JSON.stringify({ installedPacks: [] }, undefined, 2)}\n`,
  );
  writeFileSync(
    nodePath.join(repoRoot, '.safeword/hooks/codex/pre-tool-quality.ts'),
    'old Safe Word Codex PreToolUse hook\n',
  );
  writeFileSync(
    nodePath.join(repoRoot, '.safeword/hooks/codex/stop.ts'),
    'old Safe Word Codex Stop hook\n',
  );
  writeFileSync(
    nodePath.join(repoRoot, '.agents/skills/bdd/SKILL.md'),
    'old Safe Word Codex BDD skill\n',
  );
  writeFileSync(
    nodePath.join(repoRoot, '.agents/skills/verify/SKILL.md'),
    'old Safe Word Codex verify skill\n',
  );

  return repoRoot;
}

function codexHookCommandName(command: string): CodexHookCommandName | undefined {
  const match = /\bcodex-hook\s+([a-z-]+)\b/u.exec(command);
  const commandName = match?.[1];
  if (
    commandName === 'post-tool-use' ||
    commandName === 'pre-tool-use' ||
    commandName === 'session-start' ||
    commandName === 'stop' ||
    commandName === 'user-prompt-submit'
  ) {
    return commandName;
  }

  return undefined;
}

function codexHookFixture(commandName: CodexHookCommandName): {
  fixtureName: string;
  input: Record<string, unknown>;
} {
  switch (commandName) {
    case 'post-tool-use':
      return {
        fixtureName: 'PostToolUse Edit payload',
        input: {
          hook_event_name: 'PostToolUse',
          session_id: 'codex-contract-session',
          tool_name: 'Edit',
          tool_input: { file_path: 'src/generated.ts' },
        },
      };
    case 'pre-tool-use':
      return {
        fixtureName: 'PreToolUse apply_patch payload',
        input: {
          hook_event_name: 'PreToolUse',
          session_id: 'codex-contract-session',
          tool_name: 'apply_patch',
          tool_input: { command: TEST_DEFINITIONS_PATCH },
        },
      };
    case 'session-start':
      return {
        fixtureName: 'SessionStart payload',
        input: {
          hook_event_name: 'SessionStart',
          session_id: 'codex-contract-session',
        },
      };
    case 'stop':
      return {
        fixtureName: 'Stop payload',
        input: {
          hook_event_name: 'Stop',
          session_id: 'codex-contract-session',
        },
      };
    case 'user-prompt-submit':
      return {
        fixtureName: 'UserPromptSubmit payload',
        input: {
          hook_event_name: 'UserPromptSubmit',
          session_id: 'codex-contract-session',
          prompt: 'continue',
        },
      };
  }
}

Given(
  'a fresh git repo with no Safe Word Codex assets',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = createTemporaryDirectory('safeword-codex-plugin-repo-');
    writeFileSync(
      nodePath.join(repoRoot, 'package.json'),
      `${JSON.stringify({ name: 'codex-plugin-fixture', version: '1.0.0' }, undefined, 2)}\n`,
    );

    const initResult = runCommand('git', ['init', '--quiet'], { cwd: repoRoot });
    assert.equal(initResult.exitCode, 0, initResult.stderr);

    for (const relativePath of ['.agents', '.codex', '.safeword', '.claude', '.cursor']) {
      assert.equal(existsSync(nodePath.join(repoRoot, relativePath)), false, relativePath);
    }

    this.codexPluginRepoRoot = repoRoot;
  },
);

Given(
  'an isolated CODEX_HOME configured with a local Safe Word marketplace',
  function (this: CodexPluginMigrationWorld) {
    const codexHome = createTemporaryDirectory('safeword-codex-home-');
    const marketplaceRoot = createTemporaryDirectory('safeword-codex-marketplace-');

    writeLocalMarketplace(marketplaceRoot);

    this.codexPluginCodexHome = codexHome;
    this.codexPluginMarketplaceRoot = marketplaceRoot;
  },
);

Given(
  'a temporary CODEX_HOME with no installed Safe Word plugin',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = createTemporaryDirectory('safeword-codex-plugin-repo-');
    writeFileSync(
      nodePath.join(repoRoot, 'package.json'),
      `${JSON.stringify({ name: 'codex-plugin-fixture', version: '1.0.0' }, undefined, 2)}\n`,
    );
    const initResult = runCommand('git', ['init', '--quiet'], { cwd: repoRoot });
    assert.equal(initResult.exitCode, 0, initResult.stderr);

    const codexHome = createTemporaryDirectory('safeword-codex-home-');
    const marketplaceRoot = createTemporaryDirectory('safeword-codex-marketplace-');
    writeLocalMarketplace(marketplaceRoot);

    this.codexPluginRepoRoot = repoRoot;
    this.codexPluginCodexHome = codexHome;
    this.codexPluginMarketplaceRoot = marketplaceRoot;
  },
);

Given(
  "the developer's real Codex home has a recorded plugin list",
  function (this: CodexPluginMigrationWorld) {
    this.codexPluginRealListBefore = runRealCodexPluginCommand(
      requirePath(this.codexPluginRepoRoot, 'repo root'),
      ['plugin', 'list', '--json'],
    );
  },
);

Given(
  'an isolated CODEX_HOME configured with a local marketplace missing the Safe Word plugin manifest',
  function (this: CodexPluginMigrationWorld) {
    const codexHome = createTemporaryDirectory('safeword-codex-home-');
    const marketplaceRoot = createTemporaryDirectory('safeword-codex-marketplace-');

    writeLocalMarketplace(marketplaceRoot);
    mkdirSync(nodePath.join(marketplaceRoot, 'plugins/safeword'), { recursive: true });

    this.codexPluginCodexHome = codexHome;
    this.codexPluginMarketplaceRoot = marketplaceRoot;
  },
);

Given('the repo file tree has been recorded', function (this: CodexPluginMigrationWorld) {
  this.codexPluginRecordedTree = collectTree(requirePath(this.codexPluginRepoRoot, 'repo root'));
});

When(
  'the plugin install harness installs the Safe Word Codex plugin',
  function (this: CodexPluginMigrationWorld) {
    installSafeWordCodexPlugin.call(this);
  },
);

When(
  'the plugin install harness tries to install the Safe Word Codex plugin',
  function (this: CodexPluginMigrationWorld) {
    const marketplaceRoot = requirePath(this.codexPluginMarketplaceRoot, 'local marketplace root');

    const addMarketplaceResult = runCodexPluginCommand.call(this, [
      'plugin',
      'marketplace',
      'add',
      marketplaceRoot,
      '--json',
    ]);
    if (addMarketplaceResult.exitCode !== 0) {
      this.codexPluginInstallResult = addMarketplaceResult;
      return;
    }

    this.codexPluginInstallResult = runCodexPluginCommand.call(this, [
      'plugin',
      'add',
      'safeword',
      '--marketplace',
      'safeword-local',
      '--json',
    ]);
    this.codexPluginInstallSummary = summarizePluginInstallResult(this.codexPluginInstallResult);
  },
);

When('the isolated plugin install harness runs', function (this: CodexPluginMigrationWorld) {
  installSafeWordCodexPlugin.call(this);
});

Then(
  '`codex plugin list --json` reports the Safe Word plugin as installed and enabled',
  function (this: CodexPluginMigrationWorld) {
    const installResult = requirePath(
      JSON.stringify(this.codexPluginInstallResult),
      'plugin install result',
    );
    assert.equal(this.codexPluginInstallResult?.exitCode, 0, `install failed: ${installResult}`);

    const listResult = this.codexPluginListResult;
    assert.ok(listResult, 'plugin list result was not captured');
    assert.equal(listResult.exitCode, 0, listResult.stderr);

    const parsed = JSON.parse(listResult.stdout) as { installed?: CodexPluginListEntry[] };
    const safewordPlugin = parsed.installed?.find(
      entry => entry.name === 'safeword' && entry.marketplaceName === 'safeword-local',
    );

    assert.ok(safewordPlugin, `Safe Word plugin was absent from list output: ${listResult.stdout}`);
    assert.equal(safewordPlugin.installed, true);
    assert.equal(safewordPlugin.enabled, true);
  },
);

Then(
  'the install result names the plugin manifest validation failure',
  function (this: CodexPluginMigrationWorld) {
    assert.notEqual(this.codexPluginInstallResult?.exitCode, 0, 'install unexpectedly succeeded');
    assert.match(
      this.codexPluginInstallSummary ?? '',
      /plugin manifest validation failure: missing plugin\.json/u,
    );
  },
);

Then('the repo file tree is unchanged', function (this: CodexPluginMigrationWorld) {
  assert.deepEqual(
    collectTree(requirePath(this.codexPluginRepoRoot, 'repo root')),
    this.codexPluginRecordedTree,
  );
});

Then(
  'the temporary CODEX_HOME contains the Safe Word plugin install state',
  function (this: CodexPluginMigrationWorld) {
    const listResult = this.codexPluginListResult;
    assert.ok(listResult, 'isolated plugin list result was not captured');
    assert.equal(listResult.exitCode, 0, listResult.stderr);

    const parsed = JSON.parse(listResult.stdout) as { installed?: CodexPluginListEntry[] };
    const safewordPlugin = parsed.installed?.find(entry => entry.name === 'safeword');
    assert.ok(safewordPlugin, `Safe Word plugin was absent from list output: ${listResult.stdout}`);
    assert.equal(safewordPlugin.installed, true);
    assert.equal(safewordPlugin.enabled, true);
  },
);

Then(
  "the developer's real Codex plugin list is unchanged",
  function (this: CodexPluginMigrationWorld) {
    this.codexPluginRealListAfter = runRealCodexPluginCommand(
      requirePath(this.codexPluginRepoRoot, 'repo root'),
      ['plugin', 'list', '--json'],
    );
    assert.deepEqual(this.codexPluginRealListAfter, this.codexPluginRealListBefore);
  },
);

Then(
  'the repo contains no Safe Word-owned directories under `.agents`, `.codex`, `.safeword`, `.claude`, and `.cursor`',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    for (const relativePath of ['.agents', '.codex', '.safeword', '.claude', '.cursor']) {
      assert.equal(existsSync(nodePath.join(repoRoot, relativePath)), false, relativePath);
    }
  },
);

Then(
  /^the repo still has no `\.agents\/skills` Safe Word skill directory$/,
  function (this: CodexPluginMigrationWorld) {
    assert.equal(
      existsSync(
        nodePath.join(requirePath(this.codexPluginRepoRoot, 'repo root'), '.agents/skills'),
      ),
      false,
    );
  },
);

Then(
  /^the repo still has no `\.safeword\/hooks\/codex` directory$/,
  function (this: CodexPluginMigrationWorld) {
    assert.equal(
      existsSync(
        nodePath.join(requirePath(this.codexPluginRepoRoot, 'repo root'), '.safeword/hooks/codex'),
      ),
      false,
    );
  },
);

Given(
  'a fresh repo with the Safe Word Codex plugin installed and enabled',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = createTemporaryDirectory('safeword-codex-plugin-repo-');
    writeFileSync(
      nodePath.join(repoRoot, 'package.json'),
      `${JSON.stringify({ name: 'codex-plugin-fixture', version: '1.0.0' }, undefined, 2)}\n`,
    );

    const initResult = runCommand('git', ['init', '--quiet'], { cwd: repoRoot });
    assert.equal(initResult.exitCode, 0, initResult.stderr);

    const codexHome = createTemporaryDirectory('safeword-codex-home-');
    const marketplaceRoot = createTemporaryDirectory('safeword-codex-marketplace-');
    writeLocalMarketplace(marketplaceRoot);

    const marketplacePreparation = prepareMarketplacePlugin(marketplaceRoot);
    assert.equal(marketplacePreparation, undefined, marketplacePreparation?.stderr);

    this.codexPluginRepoRoot = repoRoot;
    this.codexPluginCodexHome = codexHome;
    this.codexPluginMarketplaceRoot = marketplaceRoot;

    const addMarketplaceResult = runCodexPluginCommand.call(this, [
      'plugin',
      'marketplace',
      'add',
      marketplaceRoot,
      '--json',
    ]);
    assert.equal(addMarketplaceResult.exitCode, 0, addMarketplaceResult.stderr);

    const installResult = runCodexPluginCommand.call(this, [
      'plugin',
      'add',
      'safeword',
      '--marketplace',
      'safeword-local',
      '--json',
    ]);
    assert.equal(installResult.exitCode, 0, installResult.stderr);
  },
);

Given(
  'a temporary CODEX_HOME where the Safe Word plugin is installed but disabled',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = createTemporaryDirectory('safeword-codex-plugin-repo-');
    writeFileSync(
      nodePath.join(repoRoot, 'package.json'),
      `${JSON.stringify({ name: 'codex-plugin-fixture', version: '1.0.0' }, undefined, 2)}\n`,
    );
    const initResult = runCommand('git', ['init', '--quiet'], { cwd: repoRoot });
    assert.equal(initResult.exitCode, 0, initResult.stderr);

    const codexHome = createTemporaryDirectory('safeword-codex-home-');
    const marketplaceRoot = createTemporaryDirectory('safeword-codex-marketplace-');
    writeLocalMarketplace(marketplaceRoot);

    this.codexPluginRepoRoot = repoRoot;
    this.codexPluginCodexHome = codexHome;
    this.codexPluginMarketplaceRoot = marketplaceRoot;

    installSafeWordCodexPlugin.call(this);
    assert.equal(this.codexPluginInstallResult?.exitCode, 0, this.codexPluginInstallResult?.stderr);

    const configPath = nodePath.join(codexHome, 'config.toml');
    const config = readFileSync(configPath, 'utf8');
    assert.equal(
      config.match(/^enabled = true$/gmu)?.length,
      1,
      `expected exactly one enabled plugin entry in ${configPath}`,
    );
    writeFileSync(configPath, config.replace(/^enabled = true$/mu, 'enabled = false'));

    this.codexPluginListResult = runCodexPluginCommand.call(this, ['plugin', 'list', '--json']);
    assert.equal(this.codexPluginListResult.exitCode, 0, this.codexPluginListResult.stderr);
  },
);

Given('the repo has no repo-local Safe Word skills', function (this: CodexPluginMigrationWorld) {
  assert.equal(
    existsSync(nodePath.join(requirePath(this.codexPluginRepoRoot, 'repo root'), '.agents/skills')),
    false,
  );
});

When(
  'the prompt surface is inspected with `codex debug prompt-input`',
  function (this: CodexPluginMigrationWorld) {
    this.codexPluginPromptResult = runCodexPluginCommand.call(this, [
      'debug',
      'prompt-input',
      'Use Safe Word for this feature.',
    ]);
    this.codexPluginListResult = runCodexPluginCommand.call(this, ['plugin', 'list', '--json']);
    this.codexPluginPromptAvailabilitySummary = summarizePromptAvailability(
      this.codexPluginPromptResult,
      this.codexPluginListResult,
    );
  },
);

Then('the available skills include `safeword:bdd`', function (this: CodexPluginMigrationWorld) {
  assert.equal(this.codexPluginPromptResult?.exitCode, 0, this.codexPluginPromptResult?.stderr);
  assert.ok(this.codexPluginPromptResult?.stdout.includes('safeword:bdd'));
});

Then('the available skills include `safeword:verify`', function (this: CodexPluginMigrationWorld) {
  assert.equal(this.codexPluginPromptResult?.exitCode, 0, this.codexPluginPromptResult?.stderr);
  assert.ok(this.codexPluginPromptResult?.stdout.includes('safeword:verify'));
});

Then('the available skills include `safeword:explain`', function (this: CodexPluginMigrationWorld) {
  assert.equal(this.codexPluginPromptResult?.exitCode, 0, this.codexPluginPromptResult?.stderr);
  assert.ok(this.codexPluginPromptResult?.stdout.includes('safeword:explain'));
});

Then(
  'the expected `safeword:bdd` skill is not reported as available',
  function (this: CodexPluginMigrationWorld) {
    assert.equal(this.codexPluginPromptResult?.exitCode, 0, this.codexPluginPromptResult?.stderr);
    assert.equal(this.codexPluginPromptResult?.stdout.includes('safeword:bdd'), false);
  },
);

Then(
  'the harness result says the plugin is disabled rather than treating the prompt as valid',
  function (this: CodexPluginMigrationWorld) {
    assert.equal(this.codexPluginPromptAvailabilitySummary, 'plugin disabled');
  },
);

When('the generated repo files are inspected', function (this: CodexPluginMigrationWorld) {
  const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
  this.codexPluginInspectedText = [
    collectTree(repoRoot).join('\n'),
    collectMarkdownText(SAFEWORD_CODEX_PLUGIN_ROOT),
  ].join('\n');
});

Then(
  /^no Safe Word-owned `\.agents\/skills\/bdd\/SKILL\.md` alias exists$/,
  function (this: CodexPluginMigrationWorld) {
    assert.equal(
      existsSync(
        nodePath.join(
          requirePath(this.codexPluginRepoRoot, 'repo root'),
          '.agents/skills/bdd/SKILL.md',
        ),
      ),
      false,
    );
  },
);

Then(
  /^no Safe Word-owned `\.agents\/skills\/verify\/SKILL\.md` alias exists$/,
  function (this: CodexPluginMigrationWorld) {
    assert.equal(
      existsSync(
        nodePath.join(
          requirePath(this.codexPluginRepoRoot, 'repo root'),
          '.agents/skills/verify/SKILL.md',
        ),
      ),
      false,
    );
  },
);

Then(
  'user-facing Codex examples name `safeword:<skill>` instead of bare skill names',
  function (this: CodexPluginMigrationWorld) {
    const text = this.codexPluginInspectedText ?? '';
    assert.match(text, /safeword:bdd/u);
    assert.match(text, /safeword:verify/u);
    assert.match(text, /safeword:explain/u);
    assert.doesNotMatch(text, /(?:\$|\/)(?:bdd|verify|explain)\b/u);
  },
);

Given(
  'the Safe Word package has been packed and installed into a fixture project',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = createTemporaryDirectory('safeword-codex-hook-package-');
    writeFileSync(
      nodePath.join(repoRoot, 'package.json'),
      `${JSON.stringify({ name: 'codex-hook-fixture', version: '1.0.0' }, undefined, 2)}\n`,
    );
    const initResult = runCommand('git', ['init', '--quiet'], { cwd: repoRoot });
    assert.equal(initResult.exitCode, 0, initResult.stderr);
    this.codexPluginRepoRoot = repoRoot;
  },
);

Given(
  'the Safe Word package has been packed from the working tree',
  function (this: CodexPluginMigrationWorld) {
    const { packageRoot, tarball } = packSafeWordPackage();
    this.codexPluginPackageRoot = packageRoot;
    this.codexPluginPackageTarball = tarball;
  },
);

Given(
  'the Safe Word package omits a helper required by a Codex hook entrypoint',
  function (this: CodexPluginMigrationWorld) {
    const { packageRoot, tarball } = packSafeWordPackage();
    const files = listTarballFiles(tarball);
    const missingReference = files.find(file =>
      /^package\/dist\/codex-hook-[A-Z0-9]+\.js$/u.test(file),
    );
    assert.ok(missingReference, 'packed package did not include a codex-hook chunk to remove');

    this.codexPluginPackageRoot = packageRoot;
    this.codexPluginPackageTarball = tarball;
    this.codexPluginMissingPackagedReference = missingReference;
    this.codexPluginPackageFiles = files.filter(file => file !== missingReference);
  },
);

Given(
  'the fixture has a feature ticket missing intake prerequisites',
  function (this: CodexPluginMigrationWorld) {
    createIncompleteFeatureTicket(requirePath(this.codexPluginRepoRoot, 'repo root'));
  },
);

Given(
  'the fixture has a feature ticket with completed intake prerequisites',
  function (this: CodexPluginMigrationWorld) {
    createCompleteFeatureTicket(requirePath(this.codexPluginRepoRoot, 'repo root'));
  },
);

Given(
  'the fixture has queued Safe Word prompt context for Codex',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    mkdirSync(nodePath.join(repoRoot, '.project'), { recursive: true });
    writeFileSync(
      nodePath.join(repoRoot, '.project/codex-prompt-context.txt'),
      `${PROMPT_CONTEXT_LINE}\n`,
    );
  },
);

Given(
  'the fixture has a Codex stop payload that should produce a Safe Word continuation',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    mkdirSync(nodePath.join(repoRoot, '.project'), { recursive: true });
    writeFileSync(
      nodePath.join(repoRoot, '.project/codex-stop-continuation.txt'),
      `${STOP_CONTINUATION_MESSAGE}\n`,
    );
  },
);

Given('the Safe Word Codex plugin hook manifest', function (this: CodexPluginMigrationWorld) {
  const manifestPath = nodePath.join(SAFEWORD_CODEX_PLUGIN_ROOT, 'hooks.json');
  assert.equal(existsSync(manifestPath), true, 'Safe Word Codex plugin hooks.json is missing');

  const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
  this.codexPluginHookCommands = collectHookCommands(parsed);
});

Given(
  "a repo installed with today's project-local Codex assets",
  function (this: CodexPluginMigrationWorld) {
    this.codexPluginRepoRoot = createProjectLocalCodexInstallFixture();
  },
);

Given(
  /^an old project-local Codex install with a user-authored `\.agents\/skills\/company-workflow\/SKILL\.md`$/,
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = createProjectLocalCodexInstallFixture();
    const skillPath = nodePath.join(repoRoot, '.agents/skills/company-workflow/SKILL.md');
    mkdirSync(nodePath.dirname(skillPath), { recursive: true });
    writeFileSync(
      skillPath,
      ['---', 'name: company-workflow', '---', '', '# Company Workflow', 'Use local process.'].join(
        '\n',
      ),
    );

    this.codexPluginRepoRoot = repoRoot;
    this.codexPluginUserSkillSnapshot = readFileSync(skillPath, 'utf8');
  },
);

Given(
  'an old project-local Codex install with user-authored Codex config entries',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = createProjectLocalCodexInstallFixture();
    this.codexPluginUserCodexConfigLines = [
      '[profiles.company]',
      'model = "gpt-5"',
      'sandbox_mode = "workspace-write"',
    ];

    mkdirSync(nodePath.join(repoRoot, '.codex'), { recursive: true });
    writeFileSync(
      nodePath.join(repoRoot, '.codex/config.toml'),
      [
        '# Safeword Codex project configuration.',
        '',
        ...this.codexPluginUserCodexConfigLines,
        '',
      ].join('\n'),
    );

    this.codexPluginRepoRoot = repoRoot;
  },
);

Given(
  /^the config also contains old Safe Word hook commands pointing at `\.safeword\/hooks\/codex`$/,
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    const configPath = nodePath.join(repoRoot, '.codex/config.toml');
    const current = readFileSync(configPath, 'utf8');
    writeFileSync(
      configPath,
      [
        current.trimEnd(),
        '',
        '[[hooks.PreToolUse]]',
        'matcher = "^(apply_patch|Bash|Edit|Write|MultiEdit|NotebookEdit)$"',
        '',
        '[[hooks.PreToolUse.hooks]]',
        'type = "command"',
        'command = \'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/pre-tool-quality.ts"\'',
        'timeout = 30',
        '',
        '[[hooks.Stop]]',
        '',
        '[[hooks.Stop.hooks]]',
        'type = "command"',
        'command = \'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/stop.ts"\'',
        'timeout = 600',
        '',
      ].join('\n'),
    );
  },
);

Given(
  'the repo contains user-owned tickets and learnings under the namespace root',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    mkdirSync(nodePath.join(repoRoot, '.project/tickets/USER123'), { recursive: true });
    mkdirSync(nodePath.join(repoRoot, '.project/learnings'), { recursive: true });
    writeFileSync(
      nodePath.join(repoRoot, '.project/tickets/USER123/ticket.md'),
      'user ticket content\n',
    );
    writeFileSync(
      nodePath.join(repoRoot, '.project/learnings/user-learning.md'),
      'user learning content\n',
    );
    this.codexPluginUserDataSnapshot = readUserDataSnapshot(repoRoot);
  },
);

When(
  "the packaged Codex PreToolUse entrypoint receives a supported edit payload for that ticket's `test-definitions.md`",
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    this.codexPluginHookResult = runCommand(
      process.execPath,
      [SAFEWORD_CLI_PATH, 'codex-hook', 'pre-tool-use'],
      {
        cwd: repoRoot,
        env: { CLAUDE_PROJECT_DIR: repoRoot },
        input: JSON.stringify({
          hook_event_name: 'PreToolUse',
          session_id: 'codex-test-session',
          tool_name: 'apply_patch',
          tool_input: { command: TEST_DEFINITIONS_PATCH },
        }),
      },
    );
  },
);

When(
  'the packaged Codex SessionStart entrypoint receives a SessionStart JSON fixture',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    mkdirSync(nodePath.join(repoRoot, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(repoRoot, '.safeword/SAFEWORD.md'), REPO_LOCAL_SAFEWORD_SENTINEL);

    this.codexPluginHookResult = runCommand(
      process.execPath,
      [SAFEWORD_CLI_PATH, 'codex-hook', 'session-start'],
      {
        cwd: repoRoot,
        env: { CLAUDE_PROJECT_DIR: repoRoot },
        input: JSON.stringify({
          hook_event_name: 'SessionStart',
          session_id: 'codex-test-session',
        }),
      },
    );
  },
);

When(
  'the packaged Codex PostToolUse entrypoint receives a supported edit payload fixture',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    mkdirSync(nodePath.join(repoRoot, '.project'), { recursive: true });
    writeFileSync(
      nodePath.join(repoRoot, '.project/codex-post-tool-guidance.txt'),
      `${POST_TOOL_GUIDANCE_LINE}\n`,
    );
    mkdirSync(nodePath.join(repoRoot, 'packages/cli/templates/hooks/codex'), { recursive: true });
    writeFileSync(
      nodePath.join(repoRoot, 'packages/cli/templates/hooks/codex/post-tool-quality.ts'),
      SOURCE_CHECKOUT_HOOK_SENTINEL,
    );

    this.codexPluginHookResult = runCommand(
      process.execPath,
      [SAFEWORD_CLI_PATH, 'codex-hook', 'post-tool-use'],
      {
        cwd: repoRoot,
        env: { CLAUDE_PROJECT_DIR: repoRoot },
        input: JSON.stringify({
          hook_event_name: 'PostToolUse',
          session_id: 'codex-test-session',
          tool_name: 'Edit',
          tool_input: { file_path: 'src/generated.ts' },
        }),
      },
    );
  },
);

When(
  'the packaged Codex UserPromptSubmit entrypoint receives a prompt JSON fixture',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    this.codexPluginHookResult = runCommand(
      process.execPath,
      [SAFEWORD_CLI_PATH, 'codex-hook', 'user-prompt-submit'],
      {
        cwd: repoRoot,
        env: { CLAUDE_PROJECT_DIR: repoRoot },
        input: JSON.stringify({
          hook_event_name: 'UserPromptSubmit',
          session_id: 'codex-test-session',
          prompt: 'continue',
        }),
      },
    );
  },
);

When(
  'the packaged Codex Stop entrypoint receives the stop JSON fixture',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    this.codexPluginHookResult = runCommand(
      process.execPath,
      [SAFEWORD_CLI_PATH, 'codex-hook', 'stop'],
      {
        cwd: repoRoot,
        env: { CLAUDE_PROJECT_DIR: repoRoot },
        input: JSON.stringify({
          hook_event_name: 'Stop',
          session_id: 'codex-test-session',
        }),
      },
    );
  },
);

When('the hook commands are inspected', function (this: CodexPluginMigrationWorld) {
  assert.ok(this.codexPluginHookCommands, 'hook commands were not loaded');
});

When(
  'deterministic hook contract tests enumerate the hook commands',
  function (this: CodexPluginMigrationWorld) {
    const commands = this.codexPluginHookCommands ?? [];
    const repoRoot = createCodexHookContractFixture();

    this.codexPluginHookContractResults = commands.map(command => {
      const commandName = codexHookCommandName(command);
      if (!commandName) {
        return {
          command,
          errors: ['missing exact Codex JSON fixture'],
        };
      }

      const fixture = codexHookFixture(commandName);
      const result = runCommand(process.execPath, [SAFEWORD_CLI_PATH, 'codex-hook', commandName], {
        cwd: repoRoot,
        env: { CLAUDE_PROJECT_DIR: repoRoot },
        input: JSON.stringify(fixture.input),
      });

      return {
        command,
        commandName,
        fixtureName: fixture.fixtureName,
        fixtureInput: fixture.input,
        result,
        errors: [],
      };
    });
  },
);

When(
  'the release contract inspects the package contents',
  function (this: CodexPluginMigrationWorld) {
    const tarball = requirePath(this.codexPluginPackageTarball, 'package tarball');
    this.codexPluginPackageFiles = listTarballFiles(tarball);
  },
);

When(
  'the release contract runs against the packed package',
  function (this: CodexPluginMigrationWorld) {
    this.codexPluginLiveSmokeAttempted = false;
    this.codexPluginReleaseContractErrors = inspectReleaseContract(this);
  },
);

When('the plugin migration upgrade runs', function (this: CodexPluginMigrationWorld) {
  const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
  this.codexPluginMigrationResult = runCommand(process.execPath, [SAFEWORD_CLI_PATH, 'upgrade'], {
    cwd: repoRoot,
    env: {
      SAFEWORD_SKIP_INSTALL: '1',
    },
    timeout: 120_000,
  });
});

Then(
  'the hook output denies the edit with the existing Safe Word phase-gate reason',
  function (this: CodexPluginMigrationWorld) {
    const result = this.codexPluginHookResult;
    assert.ok(result, 'hook result was not captured');
    assert.equal(result.exitCode, 0, result.stderr);

    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: {
        permissionDecision?: unknown;
        permissionDecisionReason?: unknown;
      };
    };
    assert.equal(parsed.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(String(parsed.hookSpecificOutput?.permissionDecisionReason), /scope/u);
  },
);

Then(
  'the hook output includes Safe Word standing instructions as Codex additional context',
  function (this: CodexPluginMigrationWorld) {
    const result = this.codexPluginHookResult;
    assert.ok(result, 'hook result was not captured');
    assert.equal(result.exitCode, 0, result.stderr);

    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { additionalContext?: unknown };
    };
    assert.match(
      String(parsed.hookSpecificOutput?.additionalContext),
      /SAFEWORD Agent Instructions/u,
    );
  },
);

Then(
  /^the entrypoint does not read standing instructions from repo-local `\.safeword\/SAFEWORD\.md`$/,
  function (this: CodexPluginMigrationWorld) {
    const output = `${this.codexPluginHookResult?.stdout ?? ''}\n${this.codexPluginHookResult?.stderr ?? ''}`;
    assert.equal(output.includes(REPO_LOCAL_SAFEWORD_SENTINEL), false);
  },
);

Then(/^no command contains `\.safeword\/hooks`$/, function (this: CodexPluginMigrationWorld) {
  for (const command of this.codexPluginHookCommands ?? []) {
    assert.doesNotMatch(command, /\.safeword\/hooks/u);
  }
});

Then(
  'no command depends on `git rev-parse --show-toplevel` to find Safe Word hook code',
  function (this: CodexPluginMigrationWorld) {
    for (const command of this.codexPluginHookCommands ?? []) {
      assert.doesNotMatch(command, /git rev-parse --show-toplevel/u);
    }
  },
);

Then(
  'each command invokes a packaged Safe Word command entrypoint',
  function (this: CodexPluginMigrationWorld) {
    const commands = this.codexPluginHookCommands ?? [];
    assert.ok(commands.length > 0, 'no hook commands were found');
    for (const command of commands) {
      assert.match(command, /\b(?:bunx|npx)(?:\s+--yes)?\s+safeword\b/u);
      assert.match(command, /\bcodex-hook\b/u);
    }
  },
);

Then(
  'every hook command has at least one exact Codex JSON fixture',
  function (this: CodexPluginMigrationWorld) {
    const results = this.codexPluginHookContractResults ?? [];
    assert.ok(results.length > 0, 'no hook contract commands were enumerated');

    const missingFixtures = results
      .filter(
        result =>
          result.errors.includes('missing exact Codex JSON fixture') ||
          !result.fixtureName ||
          !result.fixtureInput?.hook_event_name,
      )
      .map(result => result.command);
    assert.deepEqual(missingFixtures, []);
  },
);

Then(
  'each fixture runs through the packaged CLI entrypoint',
  function (this: CodexPluginMigrationWorld) {
    const results = this.codexPluginHookContractResults ?? [];
    assert.ok(results.length > 0, 'no hook contract results were captured');

    const failedFixtures = results
      .filter(result => result.result === undefined || result.result.exitCode !== 0)
      .map(
        result => `${result.fixtureName ?? result.command}: ${result.result?.stderr ?? 'not run'}`,
      );
    assert.deepEqual(failedFixtures, []);
  },
);

Then(
  'no fixture imports hook code from the source checkout',
  function (this: CodexPluginMigrationWorld) {
    const results = this.codexPluginHookContractResults ?? [];
    const sourceImports = results
      .filter(result =>
        `${result.result?.stdout ?? ''}\n${result.result?.stderr ?? ''}`.includes(
          SOURCE_CHECKOUT_HOOK_SENTINEL,
        ),
      )
      .map(result => result.fixtureName ?? result.command);
    assert.deepEqual(sourceImports, []);
  },
);

Then(
  'the user-owned tickets and learnings remain byte-identical',
  function (this: CodexPluginMigrationWorld) {
    const result = this.codexPluginMigrationResult;
    assert.ok(result, 'migration result was not captured');
    assert.equal(result.exitCode, 0, result.stderr);
    assert.deepEqual(
      readUserDataSnapshot(requirePath(this.codexPluginRepoRoot, 'repo root')),
      this.codexPluginUserDataSnapshot,
    );
  },
);

Then(
  /^Safe Word no longer requires repo-local `\.agents\/skills` to expose Codex skills$/,
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    assert.equal(existsSync(nodePath.join(repoRoot, '.agents/skills/bdd/SKILL.md')), false);
    assert.equal(existsSync(nodePath.join(repoRoot, '.agents/skills/verify/SKILL.md')), false);
  },
);

Then(
  /^Safe Word no longer requires repo-local `\.safeword\/hooks\/codex` scripts to run Codex hooks$/,
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    assert.equal(existsSync(nodePath.join(repoRoot, '.safeword/hooks/codex')), false);
  },
);

Then('the user-authored skill remains byte-identical', function (this: CodexPluginMigrationWorld) {
  const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
  assert.equal(
    readFileSync(nodePath.join(repoRoot, '.agents/skills/company-workflow/SKILL.md'), 'utf8'),
    this.codexPluginUserSkillSnapshot,
  );
});

Then(
  'Safe Word-owned Codex skill files no longer appear as active repo-local skills',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    assert.deepEqual(readdirSync(nodePath.join(repoRoot, '.agents/skills')).sort(), [
      'company-workflow',
    ]);
  },
);

Then('the user-authored Codex config entries remain', function (this: CodexPluginMigrationWorld) {
  const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
  const config = readFileSync(nodePath.join(repoRoot, '.codex/config.toml'), 'utf8');
  const lines = config.split(/\r?\n/u);
  for (const line of this.codexPluginUserCodexConfigLines ?? []) {
    assert.equal(lines.includes(line), true);
  }
});

Then(
  'the stale Safe Word project-local hook commands no longer remain',
  function (this: CodexPluginMigrationWorld) {
    const repoRoot = requirePath(this.codexPluginRepoRoot, 'repo root');
    const config = readFileSync(nodePath.join(repoRoot, '.codex/config.toml'), 'utf8');
    assert.equal(config.includes('.safeword/hooks/codex'), false);
  },
);

Then(
  'the package contains the Safe Word Codex plugin manifest',
  function (this: CodexPluginMigrationWorld) {
    assert.ok(requirePackageFiles(this).includes('package/codex-plugin/.codex-plugin/plugin.json'));
  },
);

Then(
  'the package contains the bundled Codex skill files',
  function (this: CodexPluginMigrationWorld) {
    const files = requirePackageFiles(this);
    for (const skill of ['bdd', 'verify', 'explain']) {
      assert.ok(files.includes(`package/codex-plugin/skills/${skill}/SKILL.md`));
    }
  },
);

Then(
  'the package contains the bundled Codex hook manifest',
  function (this: CodexPluginMigrationWorld) {
    assert.ok(requirePackageFiles(this).includes('package/codex-plugin/hooks.json'));
  },
);

Then(
  'the package contains every CLI entrypoint referenced by plugin hook commands',
  function (this: CodexPluginMigrationWorld) {
    const tarball = requirePath(this.codexPluginPackageTarball, 'package tarball');
    const files = requirePackageFiles(this);
    const hooksJson = readTarballFile(tarball, 'package/codex-plugin/hooks.json');
    const commands = collectHookCommands(JSON.parse(hooksJson));

    assert.ok(commands.length > 0, 'package hook manifest did not contain commands');
    for (const command of commands) {
      assert.match(command, /\bsafeword\s+codex-hook\b/u);
    }
    assert.ok(files.includes('package/dist/cli.js'));
    assert.ok(files.some(file => /^package\/dist\/codex-hook-[A-Z0-9]+\.js$/u.test(file)));
  },
);

Then(
  'the release contract fails before any live Codex smoke can run',
  function (this: CodexPluginMigrationWorld) {
    assert.equal(this.codexPluginLiveSmokeAttempted, false);
    assert.ok(
      (this.codexPluginReleaseContractErrors ?? []).length > 0,
      'release contract unexpectedly passed',
    );
  },
);

Then(
  'the failure names the missing packaged reference',
  function (this: CodexPluginMigrationWorld) {
    assert.ok(
      (this.codexPluginReleaseContractErrors ?? [])
        .join('\n')
        .includes(requirePath(this.codexPluginMissingPackagedReference, 'missing reference')),
    );
  },
);

Then(
  'the hook output is valid Codex continuation JSON with `decision` set to `block`',
  function (this: CodexPluginMigrationWorld) {
    const result = this.codexPluginHookResult;
    assert.ok(result, 'hook result was not captured');
    assert.equal(result.exitCode, 0, result.stderr);

    const parsed = JSON.parse(result.stdout) as { decision?: unknown; reason?: unknown };
    assert.equal(parsed.decision, 'block');
    assert.equal(typeof parsed.reason, 'string');
  },
);

Then(
  "the continuation reason contains the fixture's Safe Word continuation message",
  function (this: CodexPluginMigrationWorld) {
    const parsed = JSON.parse(this.codexPluginHookResult?.stdout ?? '') as { reason?: unknown };
    assert.match(String(parsed.reason), /Fixture Safe Word continuation/u);
    assert.match(String(parsed.reason), /queued verification/u);
  },
);

Then(
  'the hook output returns the queued context as Codex additional context',
  function (this: CodexPluginMigrationWorld) {
    const result = this.codexPluginHookResult;
    assert.ok(result, 'hook result was not captured');
    assert.equal(result.exitCode, 0, result.stderr);

    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { hookEventName?: unknown; additionalContext?: unknown };
    };
    assert.equal(parsed.hookSpecificOutput?.hookEventName, 'UserPromptSubmit');
    assert.equal(parsed.hookSpecificOutput?.additionalContext, PROMPT_CONTEXT_LINE);
  },
);

Then(
  /^the hook output is valid Codex `PostToolUse` additional context JSON$/,
  function (this: CodexPluginMigrationWorld) {
    const result = this.codexPluginHookResult;
    assert.ok(result, 'hook result was not captured');
    assert.equal(result.exitCode, 0, result.stderr);

    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { hookEventName?: unknown; additionalContext?: unknown };
    };
    assert.equal(parsed.hookSpecificOutput?.hookEventName, 'PostToolUse');
    assert.equal(typeof parsed.hookSpecificOutput?.additionalContext, 'string');
  },
);

Then(
  "the additional context contains the fixture's Safe Word guidance line",
  function (this: CodexPluginMigrationWorld) {
    const parsed = JSON.parse(this.codexPluginHookResult?.stdout ?? '') as {
      hookSpecificOutput?: { additionalContext?: unknown };
    };
    assert.match(
      String(parsed.hookSpecificOutput?.additionalContext),
      /Fixture Safe Word guidance/u,
    );
    assert.match(
      String(parsed.hookSpecificOutput?.additionalContext),
      /review the generated file/u,
    );
  },
);

Then(
  'the entrypoint does not import hook code from the source checkout',
  function (this: CodexPluginMigrationWorld) {
    const output = `${this.codexPluginHookResult?.stdout ?? ''}\n${this.codexPluginHookResult?.stderr ?? ''}`;
    assert.equal(output.includes(SOURCE_CHECKOUT_HOOK_SENTINEL), false);
    assert.doesNotMatch(output, /packages\/cli\/templates\/hooks/u);
  },
);

Then(
  'the denial tells the Codex user to run the scoped Safe Word explain skill',
  function (this: CodexPluginMigrationWorld) {
    const output = `${this.codexPluginHookResult?.stdout ?? ''}\n${this.codexPluginHookResult?.stderr ?? ''}`;
    assert.match(output, /safeword:explain/u);
  },
);

Then(
  'the hook output allows the edit without a denial payload',
  function (this: CodexPluginMigrationWorld) {
    const result = this.codexPluginHookResult;
    assert.ok(result, 'hook result was not captured');
    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout.trim(), '');
  },
);

Then('the plugin install has not created `AGENTS.md`', function (this: CodexPluginMigrationWorld) {
  assert.equal(
    existsSync(nodePath.join(requirePath(this.codexPluginRepoRoot, 'repo root'), 'AGENTS.md')),
    false,
  );
});

After(function (this: CodexPluginMigrationWorld) {
  for (const directory of [
    this.codexPluginRepoRoot,
    this.codexPluginCodexHome,
    this.codexPluginMarketplaceRoot,
    this.codexPluginPackageRoot,
  ]) {
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});
