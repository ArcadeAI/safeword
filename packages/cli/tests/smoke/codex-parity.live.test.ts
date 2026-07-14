/**
 * Live Codex plugin smoke (ticket CXP9LM / GitHub #394).
 *
 * This is deliberately opt-in: it launches a real `codex exec` session and may
 * spend tokens. Run with:
 *
 *   SAFEWORD_RUN_CODEX_LIVE_SMOKE=1 bun run --cwd packages/cli test:smoke:live
 *
 * The smoke installs the packaged plugin into an isolated CODEX_HOME. Its npx
 * command is intercepted only for `safeword` and dispatched to this checkout's
 * built CLI, proving the plugin manifest invokes the code under test instead of
 * the currently published npm package.
 */

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const PLUGIN_PATH = nodePath.resolve(import.meta.dirname, '../../codex-plugin');
const LIVE_MARKETPLACE_NAME = 'safeword-live-smoke';
const BUNX_SHIM_LOG = 'bunx-safeword-invocations.log';

function resolveCodex(): string | undefined {
  const candidates = [process.env.SMOKE_CODEX_BIN, 'codex'].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0 && /\b0\.(?:13[3-9]|1[4-9]\d|\d{3,})\./.test(probe.stdout)) {
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

function createFixture(): string {
  const projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-live-'));
  run('git', ['init', '-q'], { cwd: projectRoot });
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

function createMarketplace(root: string): string {
  const marketplaceRoot = nodePath.join(root, 'marketplace');
  const pluginRoot = nodePath.join(marketplaceRoot, 'plugins', 'safeword');
  const manifestDirectory = nodePath.join(marketplaceRoot, '.agents', 'plugins');
  mkdirSync(manifestDirectory, { recursive: true });
  cpSync(PLUGIN_PATH, pluginRoot, { recursive: true });
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

function writeBunxShim(root: string): string {
  const binDirectory = nodePath.join(root, 'bin');
  const shimPath = nodePath.join(binDirectory, 'bunx');
  mkdirSync(binDirectory, { recursive: true });
  writeFileSync(
    shimPath,
    `#!/bin/sh
set -eu
if [ "\${1:-}" = "--bun" ] && [ "\${2:-}" = "safeword@0.68.0" ]; then
  printf '%s\\n' "$*" >> "$SAFEWORD_NPX_SHIM_LOG"
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
): void {
  const environment = { CODEX_HOME: codexHome };
  assertSuccess(
    run(codex, ['plugin', 'marketplace', 'add', marketplaceRoot, '--json'], {
      cwd: projectRoot,
      env: environment,
    }),
    'codex plugin marketplace add',
  );
  assertSuccess(
    run(codex, ['plugin', 'add', `safeword@${LIVE_MARKETPLACE_NAME}`, '--json'], {
      cwd: projectRoot,
      env: environment,
    }),
    'codex plugin add',
  );
}

function runVettedPluginDispatch(
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
  assertSuccess(result, 'codex exec vetted plugin dispatch');
  return `${result.stdout}\n${result.stderr}`;
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

const CODEX = resolveCodex();
const CAN_RUN = process.env.SAFEWORD_RUN_CODEX_LIVE_SMOKE === '1' && CODEX !== undefined;

describe.skipIf(!CAN_RUN)('live smoke: Codex packaged plugin parity', () => {
  let projectRoot: string;
  let codexHome: string;
  let bunxBinDirectory: string;
  let marketplaceRoot: string;

  beforeAll(() => {
    if (!CODEX) throw new Error('unreachable: CAN_RUN guards codex presence');
    projectRoot = createFixture();
    codexHome = createAuthenticatedCodexHome();
    bunxBinDirectory = writeBunxShim(codexHome);
    marketplaceRoot = createMarketplace(codexHome);
    installPlugin(CODEX, projectRoot, codexHome, marketplaceRoot);
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(codexHome, { recursive: true, force: true });
  });

  it('runs this checkout CLI through the installed plugin lifecycle', () => {
    if (!CODEX) throw new Error('unreachable: CAN_RUN guards codex presence');

    expect(existsSync(nodePath.join(codexHome, 'config.toml'))).toBe(true);
    expect(readFileSync(nodePath.join(codexHome, 'config.toml'), 'utf8')).toContain(
      `plugins."safeword@${LIVE_MARKETPLACE_NAME}"`,
    );
    expect(existsSync(nodePath.join(projectRoot, '.codex'))).toBe(false);
    expect(existsSync(nodePath.join(projectRoot, '.safeword'))).toBe(false);
    expect(existsSync(nodePath.join(projectRoot, '.agents'))).toBe(false);

    const shimLog = nodePath.join(codexHome, BUNX_SHIM_LOG);
    const environment = {
      CODEX_HOME: codexHome,
      SAFEWORD_NPX_SHIM_LOG: shimLog,
      PATH: `${bunxBinDirectory}:${process.env.PATH ?? ''}`,
    };

    runUntrustedPluginCheck(CODEX, projectRoot, environment);
    expect(existsSync(shimLog)).toBe(false);

    const liveOutput = runVettedPluginDispatch(CODEX, projectRoot, environment);

    expect(
      readFileSync(shimLog, 'utf8'),
      `Codex did not invoke plugin SessionStart.\n${liveOutput}`,
    ).toContain('safeword hook codex session-start');
  });
});
