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
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_CODEX_ACTIVATION_CHECK_MODEL,
  HeadlessCodexActivationCheckError,
  runHeadlessCodexActivationCheck,
} from '../../src/codex-plugin/headless-activation-check.js';
import {
  type CodexHostProcessIdentity,
  writeCodexActivationMarker,
} from '../../src/codex-plugin/profile-proof.js';
import { testCliPath } from '../helpers.js';

const CLI_PATH = testCliPath;
const OLD_HOST: CodexHostProcessIdentity = {
  pid: 9001,
  started_at: '2026-08-03T00:00:00.000Z',
};
const RESTARTED_HOST: CodexHostProcessIdentity = {
  pid: 9002,
  started_at: '2026-08-03T00:02:00.000Z',
};

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

function installFakeCodex(directory: string): { bin: string; log: string } {
  const bin = nodePath.join(directory, 'bin');
  const log = nodePath.join(directory, 'codex.log');
  mkdirSync(bin, { recursive: true });
  writeExecutable(
    nodePath.join(bin, 'ps'),
    String.raw`#!/bin/sh
set -eu
printf '%s %s Mon Aug  3 00:00:00 2026 fake-codex exec\n' "$SAFEWORD_FAKE_CODEX_PID" "$SAFEWORD_FAKE_HOST_PID"
if [ "$SAFEWORD_FAKE_HOST_PID" = "9002" ]; then
  printf '%s 1 Mon Aug  3 00:02:00 2026 codex app-server\n' "$SAFEWORD_FAKE_HOST_PID"
else
  printf '%s 1 Mon Aug  3 00:00:00 2026 codex app-server\n' "$SAFEWORD_FAKE_HOST_PID"
fi
`,
  );
  writeExecutable(
    nodePath.join(bin, 'codex'),
    String.raw`#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$SAFEWORD_CODEX_LOG"
if [ "$*" = "--version" ]; then
  printf '%s\n' 'codex-cli 0.144.5'
  exit 0
fi
export SAFEWORD_FAKE_CODEX_PID=$$
if [ "$(printenv SAFEWORD_FAKE_UNSUPPORTED_MODEL 2>/dev/null || true)" = "1" ]; then
  printf '%s\n' '{"type":"turn.failed","error":{"message":"model gpt-future is not supported; upgrade the CLI"}}'
  printf '%s\n' 'fixture marketplace warning' >&2
  exit 7
fi
for event in session-start user-prompt-submit pre-tool-use post-tool-use stop; do
  case "$event" in
    session-start) input_event=SessionStart ;;
    user-prompt-submit) input_event=UserPromptSubmit ;;
    pre-tool-use) input_event=PreToolUse ;;
    post-tool-use) input_event=PostToolUse ;;
    stop) input_event=Stop ;;
  esac
  printf '{"session_id":"fixture-session","hook_event_name":"%s"}\n' "$input_event" \
    | "$SAFEWORD_BUN" "$SAFEWORD_CLI_PATH" hook codex "$event" --plugin-hook >/dev/null
done
if [ "$(printenv SAFEWORD_FAKE_FUTURE_RECEIPT 2>/dev/null || true)" = "1" ]; then
  receipt="$CODEX_HOME/safeword/activation-current-v1.json"
  "$SAFEWORD_BUN" -e 'const fs=require("node:fs");const p=process.argv[1];const v=JSON.parse(fs.readFileSync(p,"utf8"));v.activated_at="2999-01-01T00:00:00.000Z";fs.writeFileSync(p,JSON.stringify(v));' "$receipt"
fi
if [ "$(printenv SAFEWORD_FAKE_FUTURE_PROOF 2>/dev/null || true)" = "1" ]; then
  for proof in "$CODEX_HOME"/safeword/hook-proof-v2/*.json; do
    "$SAFEWORD_BUN" -e 'const fs=require("node:fs");const p=process.argv[1];const v=JSON.parse(fs.readFileSync(p,"utf8"));v.recorded_at="2999-01-01T00:00:00.000Z";fs.writeFileSync(p,JSON.stringify(v));' "$proof"
  done
fi
printf '%s\n' '{"type":"thread.started","thread_id":"fixture-thread"}'
printf '%s\n' '{"type":"turn.completed","usage":{}}'
printf '%s\n' 'fixture marketplace warning' >&2
`,
  );
  return { bin, log };
}

function createActivationFixture(
  directories: string[],
  environmentOverrides: NodeJS.ProcessEnv,
): {
  codexBinary: string;
  codexHome: string;
  environment: NodeJS.ProcessEnv;
  fakeCodex: ReturnType<typeof installFakeCodex>;
  projectRoot: string;
} {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-headless-codex-'));
  directories.push(directory);
  const projectRoot = nodePath.join(directory, 'project');
  const codexHome = nodePath.join(directory, 'profile');
  mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(projectRoot, '.safeword/config.json'), '{}\n');
  const fakeCodex = installFakeCodex(directory);
  return {
    codexBinary: nodePath.join(fakeCodex.bin, 'codex'),
    codexHome,
    environment: {
      CODEX_HOME: codexHome,
      PATH: `${fakeCodex.bin}:${process.env.PATH ?? ''}`,
      SAFEWORD_BUN: process.execPath,
      SAFEWORD_CLI_PATH: CLI_PATH,
      SAFEWORD_CODEX_LOG: fakeCodex.log,
      TZ: 'UTC',
      ...environmentOverrides,
    },
    fakeCodex,
    projectRoot,
  };
}

describe('headless Codex activation check', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories) rmSync(directory, { recursive: true, force: true });
    directories.length = 0;
  });

  it('proves all hooks without inheriting a parent task project override', () => {
    const { codexBinary, projectRoot, codexHome, fakeCodex, environment } = createActivationFixture(
      directories,
      {
        CLAUDE_PROJECT_DIR: '/another/parent-task',
        SAFEWORD_FAKE_HOST_PID: String(OLD_HOST.pid),
      },
    );
    const activationId = 'activation-stale-host';
    writeCodexActivationMarker(environment, new Date('2026-08-03T00:01:00.000Z'), {
      activationId,
      activeHosts: [OLD_HOST],
    });

    const result = runHeadlessCodexActivationCheck({
      codexBinary,
      cwd: projectRoot,
      environment,
      expectedActivation: 'pending',
      expectedActivationId: activationId,
    });

    expect(result).toMatchObject({
      activation: 'pending',
      codexVersion: 'codex-cli 0.144.5',
      model: DEFAULT_CODEX_ACTIVATION_CHECK_MODEL,
      proof: { status: 'stale' },
      warnings: ['fixture marketplace warning'],
    });
    expect(result.proof.events).toEqual([]);
    expect(readFileSync(fakeCodex.log, 'utf8')).toContain(
      `-m ${DEFAULT_CODEX_ACTIVATION_CHECK_MODEL}`,
    );
    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'))).toBe(true);
    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-current-v1.json'))).toBe(false);
  });

  it('binds successful activation to a fresh app-server identity', () => {
    const { codexBinary, projectRoot, codexHome, environment } = createActivationFixture(
      directories,
      {
        SAFEWORD_FAKE_HOST_PID: String(RESTARTED_HOST.pid),
      },
    );
    const activationId = 'activation-fresh-host';
    writeCodexActivationMarker(environment, new Date('2026-08-03T00:01:00.000Z'), {
      activationId,
      activeHosts: [OLD_HOST],
    });

    const result = runHeadlessCodexActivationCheck({
      codexBinary,
      cwd: projectRoot,
      environment,
      expectedActivation: 'activated',
      expectedActivationId: activationId,
    });

    expect(result.activation).toBe('activated');
    expect(result.activatedHost).toEqual(RESTARTED_HOST);
    expect(result.proof.activation_id).toBe(activationId);
    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'))).toBe(false);
    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-current-v1.json'))).toBe(true);
  });

  it('separates unsupported models from unrelated host warnings', () => {
    const { codexBinary, projectRoot, environment } = createActivationFixture(directories, {
      SAFEWORD_FAKE_HOST_PID: String(RESTARTED_HOST.pid),
      SAFEWORD_FAKE_UNSUPPORTED_MODEL: '1',
    });
    const model = 'gpt-future';

    let thrown: unknown;
    try {
      runHeadlessCodexActivationCheck({
        codexBinary,
        cwd: projectRoot,
        environment,
        expectedActivation: 'pending',
        expectedActivationId: 'unused-activation',
        model,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HeadlessCodexActivationCheckError);
    expect(thrown).toMatchObject({
      code: 'CODEX_MODEL_UNSUPPORTED',
      warnings: ['fixture marketplace warning'],
    });
    expect((thrown as Error).message).toContain(
      `Codex model "${model}" is unsupported by codex-cli 0.144.5`,
    );
    expect((thrown as Error).message).toContain('SAFEWORD_CODEX_SMOKE_MODEL=<model>');
  });

  it('rejects future-dated hook evidence', () => {
    const { codexBinary, projectRoot, environment } = createActivationFixture(directories, {
      SAFEWORD_FAKE_FUTURE_PROOF: '1',
      SAFEWORD_FAKE_HOST_PID: String(OLD_HOST.pid),
    });
    const activationId = 'activation-future-proof';
    writeCodexActivationMarker(environment, new Date('2026-08-03T00:01:00.000Z'), {
      activationId,
      activeHosts: [OLD_HOST],
    });

    expect(() =>
      runHeadlessCodexActivationCheck({
        codexBinary,
        cwd: projectRoot,
        environment,
        expectedActivation: 'pending',
        expectedActivationId: activationId,
      }),
    ).toThrow(/did not write a current .* timestamp/u);
  });

  it('rejects future-dated activation receipts', () => {
    const { codexBinary, projectRoot, environment } = createActivationFixture(directories, {
      SAFEWORD_FAKE_FUTURE_RECEIPT: '1',
      SAFEWORD_FAKE_HOST_PID: String(RESTARTED_HOST.pid),
    });
    const activationId = 'activation-future-receipt';
    writeCodexActivationMarker(environment, new Date('2026-08-03T00:01:00.000Z'), {
      activationId,
      activeHosts: [OLD_HOST],
    });

    expect(() =>
      runHeadlessCodexActivationCheck({
        codexBinary,
        cwd: projectRoot,
        environment,
        expectedActivation: 'activated',
        expectedActivationId: activationId,
      }),
    ).toThrow('Fresh Codex host wrote an invalid activation receipt.');
  });
});
