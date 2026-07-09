import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
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

interface CodexPluginMigrationWorld extends SafewordWorld {
  codexPluginRepoRoot?: string;
  codexPluginCodexHome?: string;
  codexPluginMarketplaceRoot?: string;
  codexPluginRecordedTree?: string[];
  codexPluginInstallResult?: CommandResult;
  codexPluginInstallSummary?: string;
  codexPluginListResult?: CommandResult;
  codexPluginPromptResult?: CommandResult;
}

interface CodexPluginListEntry {
  name?: string;
  marketplaceName?: string;
  installed?: boolean;
  enabled?: boolean;
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
  options: { cwd: string; env?: Record<string, string>; timeout?: number },
): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
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

function summarizePluginInstallResult(result: CommandResult): string {
  if (result.exitCode === 0) return 'plugin install succeeded';

  const output = `${result.stdout}\n${result.stderr}`;
  if (output.includes('missing plugin.json')) {
    return 'plugin manifest validation failure: missing plugin.json';
  }

  return output;
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
  ]) {
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});
