/**
 * Live Codex plugin smoke (ticket CXP9LM / GitHub #394).
 *
 * This opt-in test proves the installed plugin is a real cache copy of a
 * Bun-packed archive. It uses a local Bunx shim only to dispatch the pinned
 * package command to this checkout's built CLI; no npm registry package is
 * involved.
 *
 * Run with:
 *
 *   SAFEWORD_RUN_CODEX_LIVE_SMOKE=1 bun run --cwd packages/cli test:smoke:live
 *   SAFEWORD_RUN_CODEX_LIVE_SMOKE=1 SAFEWORD_RUN_CODEX_MIGRATION_SMOKE=1 bun run --cwd packages/cli test:smoke:live
 */

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrateCodexPlugin } from '../../src/commands/migrate-codex-plugin.js';
import {
  assertCachedCodexPlugin,
  parsePluginInstalledPath,
} from '../helpers/codex-plugin-cache.js';
import { extractPackedCliPackage, packCliPackage } from '../helpers/codex-plugin-package.js';

const CLI_ROOT = nodePath.resolve(import.meta.dirname, '../..');
const CLI_PATH = nodePath.join(CLI_ROOT, 'dist/cli.js');
const LIVE_MARKETPLACE_NAME = 'safeword-live-smoke';
const BUNX_SHIM_LOG = 'bunx-safeword-invocations.log';
const WORKFLOW_DIRECTORIES = ['.agents', '.codex', '.safeword'] as const;
const REQUIRED_CODEX_VERSION = '0.144.5';

function resolveCodex(): string | undefined {
  const candidates = [
    process.env.SMOKE_CODEX_BIN,
    nodePath.resolve(CLI_ROOT, '../../node_modules/.bin/codex'),
    'codex',
  ].filter((candidate): candidate is string => candidate !== undefined && candidate !== '');
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0 && probe.stdout.trim() === `codex-cli ${REQUIRED_CODEX_VERSION}`) {
      return candidate;
    }
  }
  return undefined;
}

interface RunOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  timeout?: number;
}

function run(command: string, args: string[], options: RunOptions) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: options.timeout ?? 60_000,
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function assertSuccess(
  result: { status: number | null; stdout: string; stderr: string },
  label: string,
): void {
  expect(
    result.status,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  ).toBe(0);
}

function assertSafeWordPluginEnabled(output: string): void {
  const parsed = JSON.parse(output) as {
    installed?: { enabled?: boolean; pluginId?: string }[];
  };
  expect(parsed.installed).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ enabled: true, pluginId: 'safeword@safeword' }),
    ]),
  );
}

function packageVersion(): string {
  return JSON.parse(readFileSync(nodePath.join(CLI_ROOT, 'package.json'), 'utf8'))
    .version as string;
}

function createFixture(): string {
  const projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-live-'));
  assertSuccess(run('git', ['init', '-q'], { cwd: projectRoot }), 'git init');
  writeFileSync(
    nodePath.join(projectRoot, 'package.json'),
    JSON.stringify({ name: 'codex-live-fixture', version: '1.0.0' }, undefined, 2),
  );
  return projectRoot;
}

function createAuthenticatedCodexHome(): string {
  const codexHome = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-home-'));
  const sourceAuthPath = nodePath.join(
    process.env.CODEX_HOME ?? nodePath.join(homedir(), '.codex'),
    'auth.json',
  );
  if (!existsSync(sourceAuthPath)) {
    throw new Error('live smoke requires an authenticated Codex CLI');
  }
  cpSync(sourceAuthPath, nodePath.join(codexHome, 'auth.json'));
  return codexHome;
}

function migrationMarketplaceSource(): string {
  if (process.env.SAFEWORD_CODEX_MIGRATION_SOURCE !== undefined) {
    return process.env.SAFEWORD_CODEX_MIGRATION_SOURCE;
  }

  const branch = run('git', ['branch', '--show-current'], { cwd: CLI_ROOT });
  assertSuccess(branch, 'git branch --show-current');
  const ref = branch.stdout.trim();
  if (ref === '') throw new Error('live migration smoke requires a checked-out branch');
  return `ArcadeAI/safeword@${ref}`;
}

function withEnvironment<T>(environment: NodeJS.ProcessEnv, callback: () => T): T {
  const previous = new Map(Object.keys(environment).map(key => [key, process.env[key]] as const));
  Object.assign(process.env, environment);
  try {
    return callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
    }
  }
}

function createMarketplace(root: string, extractedPackage: string): string {
  const marketplaceRoot = nodePath.join(root, 'marketplace');
  const pluginRoot = nodePath.join(marketplaceRoot, 'plugins', 'safeword');
  const manifestDirectory = nodePath.join(marketplaceRoot, '.agents', 'plugins');
  mkdirSync(nodePath.dirname(pluginRoot), { recursive: true });
  mkdirSync(manifestDirectory, { recursive: true });
  symlinkSync(nodePath.join(extractedPackage, 'codex-plugin'), pluginRoot, 'dir');
  writeFileSync(
    nodePath.join(manifestDirectory, 'marketplace.json'),
    `${JSON.stringify(
      {
        name: LIVE_MARKETPLACE_NAME,
        description: 'Isolated Safe Word plugin smoke marketplace.',
        owner: { name: 'Safe Word test suite' },
        plugins: [
          {
            name: 'safeword',
            description: 'Safe Word test plugin.',
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
  return marketplaceRoot;
}

function writeBunxShim(root: string, version: string): string {
  const binDirectory = nodePath.join(root, 'bin');
  const shimPath = nodePath.join(binDirectory, 'bunx');
  mkdirSync(binDirectory, { recursive: true });
  writeFileSync(
    shimPath,
    `#!/bin/sh
set -eu
if [ "\${1:-}" = "--bun" ] && [ "\${2:-}" = "safeword@${version}" ]; then
  printf '%s\\n' "$*" >> "$SAFEWORD_BUNX_SHIM_LOG"
  shift 2
  exec "${process.execPath}" "${CLI_PATH}" "$@"
fi
exit 1
`,
    { mode: 0o755 },
  );
  return binDirectory;
}

function installPlugin(
  codex: string,
  projectRoot: string,
  codexHome: string,
  marketplaceRoot: string,
): string {
  const environment = { CODEX_HOME: codexHome };
  assertSuccess(
    run(codex, ['plugin', 'marketplace', 'add', marketplaceRoot, '--json'], {
      cwd: projectRoot,
      env: environment,
    }),
    'codex plugin marketplace add',
  );
  const pluginAdd = run(codex, ['plugin', 'add', `safeword@${LIVE_MARKETPLACE_NAME}`, '--json'], {
    cwd: projectRoot,
    env: environment,
  });
  assertSuccess(pluginAdd, 'codex plugin add');
  return parsePluginInstalledPath(pluginAdd.stdout);
}

function assertNoProjectWorkflowTree(projectRoot: string): void {
  for (const directory of WORKFLOW_DIRECTORIES) {
    expect(existsSync(nodePath.join(projectRoot, directory)), `${directory} must not exist`).toBe(
      false,
    );
  }
}

function runUntrustedPluginCheck(
  codex: string,
  projectRoot: string,
  environment: NodeJS.ProcessEnv,
): void {
  const result = run(
    codex,
    [
      'exec',
      '--json',
      '--dangerously-bypass-approvals-and-sandbox',
      '-C',
      projectRoot,
      'Reply with exactly OK. Do not use tools.',
    ],
    { cwd: projectRoot, env: environment, timeout: 180_000 },
  );
  assertSuccess(result, 'codex exec untrusted plugin check');
}

function runCachedSkillProbe(
  codex: string,
  projectRoot: string,
  environment: NodeJS.ProcessEnv,
): string {
  const result = run(
    codex,
    [
      'exec',
      '--json',
      '--dangerously-bypass-approvals-and-sandbox',
      '-C',
      projectRoot,
      'Use $safeword:bdd. Reply with exactly SAFEWORD_CACHE_SKILL_READY. Do not use tools.',
    ],
    { cwd: projectRoot, env: environment, timeout: 180_000 },
  );
  assertSuccess(result, 'codex exec cached skill probe');
  return `${result.stdout}\n${result.stderr}`;
}

function runCacheDispatchWithTrustBypass(
  codex: string,
  projectRoot: string,
  environment: NodeJS.ProcessEnv,
): string {
  const result = run(
    codex,
    [
      'exec',
      '--json',
      '--dangerously-bypass-hook-trust',
      '--dangerously-bypass-approvals-and-sandbox',
      '-C',
      projectRoot,
      'Reply with exactly OK. Do not use tools.',
    ],
    { cwd: projectRoot, env: environment, timeout: 180_000 },
  );
  assertSuccess(result, 'codex exec cache dispatch with trust bypass');
  return `${result.stdout}\n${result.stderr}`;
}

const CODEX = resolveCodex();
const CAN_RUN = process.env.SAFEWORD_RUN_CODEX_LIVE_SMOKE === '1' && CODEX !== undefined;
const CAN_RUN_MIGRATION = CAN_RUN && process.env.SAFEWORD_RUN_CODEX_MIGRATION_SMOKE === '1';
const KEEP_LIVE_FIXTURE = process.env.SAFEWORD_KEEP_CODEX_LIVE_FIXTURE === '1';

const LEGACY_HOOK_CONFIG = `# Legacy Safe Word Codex project configuration.

[[hooks.PreToolUse]]
matcher = "^(apply_patch)$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'npx --yes safeword hook codex pre-tool-use'
`;

describe.skipIf(!CAN_RUN)('live smoke: Codex packaged plugin parity', () => {
  let projectRoot: string;
  let codexHome: string;
  let bunxBinDirectory: string;
  let installedPath: string;
  let packDestination: string;

  beforeAll(() => {
    if (!CODEX) throw new Error('unreachable: CAN_RUN guards codex presence');

    projectRoot = createFixture();
    codexHome = createAuthenticatedCodexHome();
    bunxBinDirectory = writeBunxShim(codexHome, packageVersion());
    packDestination = nodePath.join(codexHome, 'packed-plugin');
    mkdirSync(packDestination, { recursive: true });
    const archive = packCliPackage(CLI_ROOT, packDestination);
    const extractedPackage = extractPackedCliPackage(archive, packDestination);
    const marketplaceRoot = createMarketplace(codexHome, extractedPackage);
    installedPath = installPlugin(CODEX, projectRoot, codexHome, marketplaceRoot);

    rmSync(archive, { force: true });
    rmSync(nodePath.dirname(extractedPackage), { recursive: true, force: true });
    rmSync(marketplaceRoot, { recursive: true, force: true });
  });

  afterAll(() => {
    if (KEEP_LIVE_FIXTURE) {
      process.stdout.write(
        `Preserved Codex trust fixture:\nCODEX_HOME=${codexHome}\nPROJECT_ROOT=${projectRoot}\nINSTALLED_PATH=${installedPath}\nBUNX_LOG=${nodePath.join(codexHome, BUNX_SHIM_LOG)}\n`,
      );
      return;
    }
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(codexHome, { recursive: true, force: true });
  });

  it(`loads the complete plugin from Codex ${REQUIRED_CODEX_VERSION} cache after every source is removed`, () => {
    if (!CODEX) throw new Error('unreachable: CAN_RUN guards codex presence');

    expect(readdirSync(packDestination)).toEqual([]);
    expect(existsSync(nodePath.join(codexHome, 'marketplace'))).toBe(false);
    expect(readFileSync(nodePath.join(codexHome, 'config.toml'), 'utf8')).toContain(
      `plugins."safeword@${LIVE_MARKETPLACE_NAME}"`,
    );
    assertNoProjectWorkflowTree(projectRoot);

    const cachedPluginPath = assertCachedCodexPlugin(CLI_ROOT, codexHome, installedPath);
    expect(cachedPluginPath).not.toContain(nodePath.join(codexHome, 'packed-plugin'));

    const shimLog = nodePath.join(codexHome, BUNX_SHIM_LOG);
    const environment = {
      CODEX_HOME: codexHome,
      SAFEWORD_BUNX_SHIM_LOG: shimLog,
      PATH: `${bunxBinDirectory}:${process.env.PATH ?? ''}`,
    };

    runUntrustedPluginCheck(CODEX, projectRoot, environment);
    expect(existsSync(shimLog)).toBe(false);

    const skillOutput = runCachedSkillProbe(CODEX, projectRoot, environment);
    expect(skillOutput).toContain('SAFEWORD_CACHE_SKILL_READY');
    expect(existsSync(shimLog)).toBe(false);

    // The bypass proves cache dispatch only. Interactive /hooks trust remains manual acceptance.
    const liveOutput = runCacheDispatchWithTrustBypass(CODEX, projectRoot, environment);
    expect(
      readFileSync(shimLog, 'utf8'),
      `Codex did not invoke cached plugin SessionStart.\n${liveOutput}`,
    ).toContain(`--bun safeword@${packageVersion()} hook codex session-start`);
    assertNoProjectWorkflowTree(projectRoot);
  });
});

describe.skipIf(!CAN_RUN_MIGRATION)('live smoke: Codex public migration', () => {
  let projectRoot: string;
  let codexHome: string;

  beforeAll(() => {
    projectRoot = createFixture();
    codexHome = createAuthenticatedCodexHome();
    const configDirectory = nodePath.join(projectRoot, '.codex');
    mkdirSync(configDirectory, { recursive: true });
    writeFileSync(nodePath.join(configDirectory, 'config.toml'), LEGACY_HOOK_CONFIG);
  });

  afterAll(() => {
    if (KEEP_LIVE_FIXTURE) {
      process.stdout.write(
        `Preserved Codex migration fixture:\nCODEX_HOME=${codexHome}\nPROJECT_ROOT=${projectRoot}\n`,
      );
      return;
    }
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(codexHome, { recursive: true, force: true });
  });

  it('installs and verifies the marketplace plugin without deleting unreviewed legacy hooks', () => {
    if (!CODEX) throw new Error('unreachable: CAN_RUN_MIGRATION guards codex presence');

    withEnvironment(
      {
        CODEX_HOME: codexHome,
        PATH: `${nodePath.resolve(CLI_ROOT, '../../node_modules/.bin')}:${process.env.PATH ?? ''}`,
      },
      () => {
        migrateCodexPlugin(projectRoot, { marketplaceSource: migrationMarketplaceSource() });
      },
    );

    expect(readFileSync(nodePath.join(projectRoot, '.codex', 'config.toml'), 'utf8')).toBe(
      LEGACY_HOOK_CONFIG,
    );
    expect(existsSync(nodePath.join(projectRoot, '.agents'))).toBe(false);
    expect(existsSync(nodePath.join(projectRoot, '.safeword'))).toBe(false);

    const pluginList = run(CODEX, ['plugin', 'list', '--json'], {
      cwd: projectRoot,
      env: { CODEX_HOME: codexHome },
    });
    assertSuccess(pluginList, 'codex plugin list');
    assertSafeWordPluginEnabled(pluginList.stdout);
  });
});
