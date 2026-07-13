import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const TARGET_VERSION = '0.58.0';
const NOW = Date.parse('2026-06-25T00:00:00Z');
type SafewordCommand = 'setup';

interface CommandCall {
  command: string;
  args: readonly string[];
}

type AutoUpgradeOutcome = {
  kind: 'notify';
  message: string;
};

interface UpdateCache {
  failedAttempts?: number;
  failedVersion?: string;
}

interface AutoUpgradeCodexWorld extends SafewordWorld {
  cache?: UpdateCache;
  codexConfig?: string;
  codexSessionStartCommands?: string[];
  majorOutcome?: AutoUpgradeOutcome;
  projectDirectory?: string;
  rollbackCalls?: CommandCall[];
}

function createProjectDirectory(): string {
  return mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-auto-upgrade-codex-'));
}

function runSafeword(projectDirectory: string, command: SafewordCommand): void {
  execFileSync(process.execPath, [CLI_PATH, command], {
    cwd: projectDirectory,
    env: { ...process.env, SAFEWORD_NO_AUTO_UPGRADE: '1', SAFEWORD_SKIP_INSTALL: '1' },
    stdio: 'pipe',
  });
}

function runSafewordSetup(projectDirectory: string): void {
  runSafeword(projectDirectory, 'setup');
}

function readProjectFile(projectDirectory: string, relativePath: string): string {
  return readFileSync(nodePath.join(projectDirectory, relativePath), 'utf8');
}

function runBunJson(source: string): unknown {
  const stdout = execFileSync('bun', ['--eval', source], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });
  return JSON.parse(stdout) as unknown;
}

function extractSessionStartCommands(codexConfig: string): string[] {
  const sessionStartSectionPattern =
    /\[\[hooks\.SessionStart\]\][\s\S]*?(?=\n\[\[hooks\.(?!SessionStart)|\n\[mcp_servers\.|$)/;
  const sessionStartMatch = sessionStartSectionPattern.exec(codexConfig);
  const sessionStartSection = sessionStartMatch?.[0] ?? '';
  return sessionStartSection
    .matchAll(/command = '(?<command>[^']+)'/g)
    .map(match => match.groups?.command ?? '')
    .toArray();
}

After(function (this: AutoUpgradeCodexWorld) {
  if (this.projectDirectory === undefined) return;
  rmSync(this.projectDirectory, { recursive: true, force: true });
});

Given('a fresh project runs safeword setup', function (this: AutoUpgradeCodexWorld) {
  this.projectDirectory = createProjectDirectory();
  runSafewordSetup(this.projectDirectory);
});

Given(
  'a safeword-managed project has SAFEWORD.md standing instructions',
  function (this: AutoUpgradeCodexWorld) {
    this.projectDirectory = createProjectDirectory();
    runSafewordSetup(this.projectDirectory);
    assert.ok(existsSync(nodePath.join(this.projectDirectory, '.safeword/SAFEWORD.md')));
  },
);

Given('a major safeword version is available', function (this: AutoUpgradeCodexWorld) {
  this.majorOutcome = {
    kind: 'notify',
    message: 'v2.0.0 available (major) - run `bunx safeword@2.0.0 upgrade` to update',
  };
});

Given('a clean git project has safeword-managed files', function (this: AutoUpgradeCodexWorld) {
  this.projectDirectory = createProjectDirectory();
  execFileSync('git', ['init', '-q'], { cwd: this.projectDirectory });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: this.projectDirectory });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: this.projectDirectory });
  mkdirSync(nodePath.join(this.projectDirectory, '.safeword/hooks'), { recursive: true });
  writeFileSync(nodePath.join(this.projectDirectory, '.safeword/version'), '0.57.0\n');
  writeFileSync(nodePath.join(this.projectDirectory, '.safeword/SAFEWORD.md'), '# SAFEWORD\n');
});

Given(
  'the upgrade command changes tracked and untracked safeword-managed files before failing',
  function (this: AutoUpgradeCodexWorld) {
    assert.ok(this.projectDirectory, 'project directory was not created');
  },
);

When('the generated Codex config is inspected', function (this: AutoUpgradeCodexWorld) {
  assert.ok(this.projectDirectory, 'project directory was not created');
  this.codexConfig = readProjectFile(this.projectDirectory, '.codex/config.toml');
  this.codexSessionStartCommands = extractSessionStartCommands(this.codexConfig);
});

When(
  'the Codex SessionStart dispatcher runs with no upgrade to apply',
  function (this: AutoUpgradeCodexWorld) {
    assert.ok(this.projectDirectory, 'project directory was not created');
    const dispatcherPath = ['.safeword/hooks', 'session-codex-start.ts'].join('/');
    const result = spawnSync('bun', [dispatcherPath], {
      cwd: this.projectDirectory,
      env: { ...process.env, SAFEWORD_NO_AUTO_UPGRADE: '1' },
      input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: this.projectDirectory }),
      encoding: 'utf8',
    });
    this.result = {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.status ?? 1,
    };
  },
);

When(
  'the Claude auto-upgrade wrapper handles the shared core outcome',
  function (this: AutoUpgradeCodexWorld) {
    assert.ok(this.majorOutcome, 'major-version outcome was not prepared');
    const response = runBunJson(`
      import { toClaudeAutoUpgradeResponse } from "./packages/cli/templates/hooks/lib/auto-upgrade.ts";
      const outcome = ${JSON.stringify(this.majorOutcome)};
      console.log(JSON.stringify(toClaudeAutoUpgradeResponse(outcome)));
    `) as { exitCode: number; stdout?: string; stderr?: string };
    this.result = {
      stdout: response.stdout ?? '',
      stderr: response.stderr ?? '',
      exitCode: response.exitCode,
    };
  },
);

When(
  'the Codex SessionStart dispatcher handles the shared core outcome',
  function (this: AutoUpgradeCodexWorld) {
    assert.ok(this.majorOutcome, 'major-version outcome was not prepared');
    const response = runBunJson(`
      import { toCodexSessionStartResponse } from "./packages/cli/templates/hooks/lib/auto-upgrade.ts";
      const outcome = ${JSON.stringify(this.majorOutcome)};
      console.log(JSON.stringify(toCodexSessionStartResponse({
        outcome,
        additionalContext: "SAFEWORD.md standing instructions",
      })));
    `) as { exitCode: number; stdout?: string; stderr?: string };
    this.result = {
      stdout: response.stdout ?? '',
      stderr: response.stderr ?? '',
      exitCode: response.exitCode,
    };
  },
);

When(
  'the shared auto-upgrade core records the failed attempt',
  function (this: AutoUpgradeCodexWorld) {
    assert.ok(this.projectDirectory, 'project directory was not created');
    const result = runBunJson(`
      import { readFileSync } from "node:fs";
      import path from "node:path";
      import { runAutoUpgrade } from "./packages/cli/templates/hooks/lib/auto-upgrade.ts";

      const projectDir = ${JSON.stringify(this.projectDirectory)};
      const calls = [];
      const execSync = command => {
        if (command === "git status --porcelain") return "";
        if (command === "git symbolic-ref -q HEAD") return "";
        if (command === "git rev-parse -q --verify MERGE_HEAD") throw new Error("no merge");
        if (command === "git diff --name-only") return ".safeword/SAFEWORD.md\\nsrc/app.ts\\n";
        if (command === "git diff --cached --name-only") return ".safeword/hooks/staged-new.ts\\n";
        if (command === "git ls-files --others --exclude-standard") {
          return ".safeword/hooks/new.ts\\nnotes.txt\\n";
        }
        throw new Error(\`unexpected execSync command: \${command}\`);
      };
      const execFileSync = (command, args) => {
        calls.push({ command, args });
        if (command === "bunx") throw new Error("upgrade failed");
        return "";
      };

      await runAutoUpgrade({
        projectDir,
        filterSafewordFiles: (changedFiles, untrackedFiles) =>
          [...changedFiles, ...untrackedFiles].filter(file => file.startsWith(".safeword/")),
        env: {},
        now: () => ${NOW},
        fetchLatestFromNpm: async () => ({
          latestVersion: ${JSON.stringify(TARGET_VERSION)},
          publishedAt: ${NOW} - 2 * 24 * 60 * 60 * 1000,
          checkedAt: ${NOW},
        }),
        execSync,
        execFileSync,
        dogfoodRepo: () => false,
      });

      console.log(JSON.stringify({
        rollbackCalls: calls.filter(call => call.command === "git"),
        cache: JSON.parse(readFileSync(path.join(projectDir, ".safeword/.update-cache.json"), "utf8")),
      }));
    `) as { cache: UpdateCache; rollbackCalls: CommandCall[] };

    this.rollbackCalls = result.rollbackCalls;
    this.cache = result.cache;
  },
);

Then('exactly one safeword SessionStart command is wired', function (this: AutoUpgradeCodexWorld) {
  assert.equal(this.codexSessionStartCommands?.length, 1);
});

Then(
  'the command runs `safeword codex-hook session-start`',
  function (this: AutoUpgradeCodexWorld) {
    assert.match(this.codexSessionStartCommands?.[0] ?? '', /safeword codex-hook session-start/);
  },
);

Then(
  'the command does not run `session-safeword-context.ts` directly',
  function (this: AutoUpgradeCodexWorld) {
    assert.doesNotMatch(this.codexSessionStartCommands?.[0] ?? '', /session-safeword-context\.ts/);
  },
);

Then('it exits successfully', function (this: AutoUpgradeCodexWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
});

Then(
  'it emits Codex SessionStart additionalContext containing SAFEWORD.md',
  function (this: AutoUpgradeCodexWorld) {
    const output = JSON.parse(this.result.stdout) as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    assert.equal(output.hookSpecificOutput?.hookEventName, 'SessionStart');
    assert.match(output.hookSpecificOutput?.additionalContext ?? '', /SAFEWORD Agent Instructions/);
  },
);

Then('it writes the manual-upgrade notice to stderr', function (this: AutoUpgradeCodexWorld) {
  assert.match(this.result.stderr, /v2\.0\.0 available/);
  assert.equal(this.result.stdout, '');
});

Then('it exits with code {int}', function (this: AutoUpgradeCodexWorld, expected: number) {
  assert.equal(this.result.exitCode, expected, this.result.stderr || this.result.stdout);
});

Then('the notice is included in Codex SessionStart output', function (this: AutoUpgradeCodexWorld) {
  const output = JSON.parse(this.result.stdout) as { systemMessage?: string };
  assert.match(output.systemMessage ?? '', /v2\.0\.0 available/);
  assert.equal(this.result.stderr, '');
});

Then(
  'safeword-managed changes from the failed upgrade are rolled back',
  function (this: AutoUpgradeCodexWorld) {
    assert.deepEqual(this.rollbackCalls, [
      {
        command: 'git',
        args: ['reset', '--', '.safeword/SAFEWORD.md', '.safeword/hooks/staged-new.ts'],
      },
      { command: 'git', args: ['checkout', '--', '.safeword/SAFEWORD.md'] },
      { command: 'git', args: ['checkout', '--', '.safeword/hooks/staged-new.ts'] },
      {
        command: 'git',
        args: ['clean', '-f', '--', '.safeword/hooks/staged-new.ts', '.safeword/hooks/new.ts'],
      },
    ]);
  },
);

Then(
  'the failure strike is recorded for the target version',
  function (this: AutoUpgradeCodexWorld) {
    assert.equal(this.cache?.failedVersion, TARGET_VERSION);
    assert.equal(this.cache?.failedAttempts, 1);
  },
);
