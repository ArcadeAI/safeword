import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cancelAllReviewerLogins,
  cancelReviewerLogin,
  capturedReviewerLogin,
  startReviewerLogin,
} from '../../src/codex-plugin/reviewer-login.js';
import { trustedReviewerExecutable } from '../../src/review/runtime.js';

vi.mock('../../src/review/runtime.js', () => ({ trustedReviewerExecutable: vi.fn() }));

type Reviewer = 'claude' | 'codex';
const loginWithContinuation = startReviewerLogin as (
  key: string,
  reviewer: Reviewer,
  root: string,
  options: { onAuthenticated: (signal: AbortSignal) => Promise<void> | void },
) => Promise<{ auth_url: string; device_code?: string }>;
const roots: string[] = [];

afterEach(() => {
  cancelAllReviewerLogins();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function until(check: () => boolean): Promise<void> {
  const deadline = performance.now() + 3000;
  while (!check() && performance.now() < deadline) await delay(10);
  expect(check(), 'login continuation must settle').toBe(true);
}

function statusOutput(reviewer: Reviewer, outcome: string): string {
  if (reviewer === 'claude') {
    const method = outcome === 'wrong-method' ? 'api_key' : 'claude.ai';
    const directory = outcome === 'wrong-directory' ? 'root' : 'profile';
    return `process.stdout.write(JSON.stringify({loggedIn:true, authMethod:${JSON.stringify(method)}, configDirectory:${directory}}));`;
  }
  const messages: Record<string, string> = {
    'wrong-method': 'Logged in using an API key',
    'access-token': 'Logged in using access token',
  };
  return `process.stderr.write(${JSON.stringify(messages[outcome] ?? 'Logged in using ChatGPT')});`;
}

function fixture(reviewer: Reviewer, outcome = 'success') {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-auth-continuation-'));
  roots.push(root);
  const profile = nodePath.join(root, 'assigned-profile');
  mkdirSync(profile);
  vi.stubEnv(reviewer === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME', profile);
  for (const key of [
    'ANTHROPIC_API_KEY',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'OPENAI_API_KEY',
    'CODEX_API_KEY',
    'AZURE_OPENAI_API_KEY',
  ])
    vi.stubEnv(key, '');
  const executable = nodePath.join(root, 'vendor');
  const commandLog = nodePath.join(root, 'commands.jsonl');
  writeFileSync(
    executable,
    String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const root = ${JSON.stringify(root)};
const profile = process.env.${reviewer === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME'};
const args = process.argv.slice(2);
const status = args.includes('status');
fs.appendFileSync(${JSON.stringify(commandLog)}, JSON.stringify({args, profile, cwd:process.cwd(), pid:process.pid})+'\n');
const wait = setInterval(() => {
  if (!fs.existsSync(root + (status ? '/release-status' : '/release-login'))) return;
  clearInterval(wait);
  if (!status) process.exit(${outcome === 'login-failure' ? 7 : 0});
  ${statusOutput(reviewer, outcome)}
  process.exit(${outcome === 'status-failure' ? 1 : 0});
}, 5);
if (!status) process.stdout.write(${JSON.stringify(reviewer === 'claude' ? 'Open https://claude.com/cai/oauth/authorize?state=fixture\n' : 'Open https://auth.openai.com/codex/device\nEnter ABCD-EFGH\n')});
`,
    { mode: 0o755 },
  );
  vi.mocked(trustedReviewerExecutable).mockReturnValue(executable);
  const key = `${root}:review`;
  const resumed = nodePath.join(root, 'resumed');
  return {
    root,
    key,
    profile,
    resumed,
    releaseLogin: () => {
      writeFileSync(nodePath.join(root, 'release-login'), '');
    },
    releaseStatus: () => {
      writeFileSync(nodePath.join(root, 'release-status'), '');
    },
    commands: () =>
      readFileSync(commandLog, 'utf8')
        .trim()
        .split('\n')
        .map(
          line => JSON.parse(line) as { args: string[]; profile: string; cwd: string; pid: number },
        ),
    start: () =>
      loginWithContinuation(key, reviewer, root, {
        onAuthenticated: () => {
          writeFileSync(resumed, 'authenticated');
        },
      }),
  };
}

describe('confirmed reviewer login continuation', () => {
  it.each(['claude', 'codex'] as const)(
    'resumes %s only after the same-profile status succeeds',
    async reviewer => {
      const login = fixture(reviewer);
      await login.start();
      login.releaseLogin();
      login.releaseStatus();
      await until(() => capturedReviewerLogin(login.key) === undefined);
      expect(existsSync(login.resumed), 'confirmed login must resume automatically').toBe(true);
      const commands = login.commands();
      expect(commands.map(command => command.args)).toEqual(
        reviewer === 'claude'
          ? [
              ['auth', 'login'],
              ['auth', 'status', '--json'],
            ]
          : [
              ['login', '--device-auth'],
              ['login', 'status'],
            ],
      );
      expect(commands.map(command => command.profile)).toEqual([login.profile, login.profile]);
      expect(commands[0]?.cwd).toBe(commands[1]?.cwd);
    },
  );

  it.each([
    ['claude', 'login-failure'],
    ['claude', 'status-failure'],
    ['claude', 'wrong-method'],
    ['claude', 'wrong-directory'],
    ['codex', 'status-failure'],
    ['codex', 'wrong-method'],
    ['codex', 'access-token'],
  ] as const)('rejects %s %s even when status can exit successfully', async (reviewer, outcome) => {
    const login = fixture(reviewer, outcome);
    await login.start();
    login.releaseLogin();
    login.releaseStatus();
    await until(() => capturedReviewerLogin(login.key) === undefined);
    expect(existsSync(login.resumed)).toBe(false);
  });

  it('cancels an in-flight authentication check before a successful completion', async () => {
    const login = fixture('claude');
    await login.start();
    login.releaseLogin();
    await until(() => login.commands().length === 2);
    const command = login.commands()[1];
    if (command === undefined) throw new Error('The authentication-check process did not start');
    const pid = command.pid;
    cancelReviewerLogin(login.key);
    login.releaseStatus();
    await until(() => {
      try {
        process.kill(pid, 0);
        return false;
      } catch {
        return true;
      }
    });
    expect(existsSync(login.resumed)).toBe(false);
  });

  it.each([599_000, 600_000])(
    'enforces the ten-minute deadline at %i milliseconds',
    async elapsed => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const login = fixture('claude');
      await login.start();
      await vi.advanceTimersByTimeAsync(elapsed);
      login.releaseLogin();
      login.releaseStatus();
      await until(() => capturedReviewerLogin(login.key) === undefined);
      expect(existsSync(login.resumed)).toBe(elapsed < 600_000);
    },
  );
});
