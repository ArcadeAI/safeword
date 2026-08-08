/**
 * Live Claude plugin discovery smoke.
 *
 * This test crosses the real Claude CLI process boundary without starting a
 * model session. It proves that the marketplace metadata, plugin manifest,
 * installed cache layout, and host component discovery agree.
 *
 * Run with:
 *
 *   SAFEWORD_RUN_CLAUDE_PLUGIN_LIVE=1 bun run --cwd packages/cli test:smoke:live -- tests/smoke/claude-plugin-discovery.live.test.ts
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CLI_ROOT = nodePath.resolve(import.meta.dirname, '../..');
const REPO_ROOT = nodePath.resolve(CLI_ROOT, '../..');
const CLAUDE = process.env.SMOKE_CLAUDE_BIN ?? 'claude';

interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(
  args: string[],
  configDirectory: string,
  cwd: string,
  timeout = 60_000,
): CommandResult {
  const result = spawnSync(CLAUDE, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDirectory },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout,
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function assertSuccess(result: CommandResult, label: string): void {
  expect(
    result.status,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  ).toBe(0);
}

const CLAUDE_AVAILABLE = spawnSync(CLAUDE, ['--version'], { encoding: 'utf8' }).status === 0;
const CAN_RUN = process.env.SAFEWORD_RUN_CLAUDE_PLUGIN_LIVE === '1' && CLAUDE_AVAILABLE;
const CAN_RUN_ACTIVATION = CAN_RUN && process.env.SAFEWORD_RUN_CLAUDE_SKILL_ACTIVATION === '1';
const compareStrings = (left: string, right: string): number => left.localeCompare(right);

describe.skipIf(!CAN_RUN)('live smoke: Claude packaged skill discovery', () => {
  let configDirectory: string;
  let projectDirectory: string;
  let details: CommandResult;
  let pluginList: CommandResult;

  beforeAll(() => {
    configDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-config-'));
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-project-'));

    const marketplace = run(
      ['plugin', 'marketplace', 'add', REPO_ROOT],
      configDirectory,
      projectDirectory,
    );
    assertSuccess(marketplace, 'claude plugin marketplace add');

    const install = run(
      ['plugin', 'install', 'safeword@safeword', '--scope', 'user'],
      configDirectory,
      projectDirectory,
    );
    assertSuccess(install, 'claude plugin install');

    details = run(['plugin', 'details', 'safeword@safeword'], configDirectory, projectDirectory);
    assertSuccess(details, 'claude plugin details');

    pluginList = run(['plugin', 'list', '--json'], configDirectory, projectDirectory);
    assertSuccess(pluginList, 'claude plugin list');
  });

  afterAll(() => {
    rmSync(configDirectory, { recursive: true, force: true });
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('discovers the complete skill inventory through an installed marketplace plugin', () => {
    const inventory = JSON.parse(
      readFileSync(nodePath.join(REPO_ROOT, 'plugin/inventory.json'), 'utf8'),
    ) as { assets?: { path?: unknown }[] };
    const expectedSkills = (inventory.assets ?? [])
      .map(asset => asset.path)
      .filter(
        (assetPath): assetPath is string =>
          typeof assetPath === 'string' && /^skills\/[^/]+\/SKILL\.md$/u.test(assetPath),
      )
      .map(assetPath => assetPath.split('/', 2)[1])
      .toSorted(compareStrings);
    const skillsLine = details.stdout
      .split('\n')
      .find(line => line.trimStart().startsWith('Skills ('));
    const discoveredSkills = skillsLine
      ?.replace(/^\s*Skills \(\d+\)\s*/u, '')
      .split(',')
      .map(skill => skill.trim())
      .filter(Boolean)
      .toSorted(compareStrings);

    expect(discoveredSkills).toEqual(expectedSkills);
  });

  it('uses the marketplace version when the packaged manifest intentionally omits one', () => {
    const packageVersion = JSON.parse(readFileSync(nodePath.join(CLI_ROOT, 'package.json'), 'utf8'))
      .version as string;
    const installedPlugins = JSON.parse(pluginList.stdout) as { id?: unknown; version?: unknown }[];
    const safeword = installedPlugins.find(plugin => plugin.id === 'safeword@safeword');

    expect(safeword?.version).toBe(packageVersion);
  });

  it.skipIf(!CAN_RUN_ACTIVATION)(
    'invokes a discovered skill through the real host and packaged runtime helper',
    () => {
      const activation = run(
        [
          '-p',
          '--dangerously-skip-permissions',
          '--max-turns',
          '8',
          'Invoke /safeword:quality-review on the text "hello". End your response with exactly SAFEWORD_CLAUDE_SKILL_READY.',
        ],
        configDirectory,
        projectDirectory,
        180_000,
      );
      assertSuccess(activation, 'claude skill activation');
      expect(activation.stdout).toContain('SAFEWORD_CLAUDE_SKILL_READY');

      const invocationLog = nodePath.join(projectDirectory, '.project/skill-invocations.log');
      expect(existsSync(invocationLog)).toBe(true);
      expect(readFileSync(invocationLog, 'utf8')).toMatch(/\squality-review$/mu);
    },
    180_000,
  );
});
