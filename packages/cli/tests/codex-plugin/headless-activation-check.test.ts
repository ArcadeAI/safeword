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
  runHeadlessCodexActivationCheck,
} from '../../src/codex-plugin/headless-activation-check.js';
import {
  CODEX_PLUGIN_HOOK_EVENTS,
  type CodexHostProcessIdentity,
  writeCodexActivationMarker,
} from '../../src/codex-plugin/profile-proof.js';

const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const OLD_HOST: CodexHostProcessIdentity = {
  pid: 9001,
  started_at: '2026-08-03T00:00:00.000Z',
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
printf '%s 1 Mon Aug  3 00:00:00 2026 codex app-server\n' "$SAFEWORD_FAKE_HOST_PID"
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
for event in session-start user-prompt-submit pre-tool-use post-tool-use stop; do
  printf '%s\n' '{}' | "$SAFEWORD_BUN" "$SAFEWORD_CLI_PATH" hook codex "$event" --plugin-hook >/dev/null
done
printf '%s\n' '{"type":"thread.started","thread_id":"fixture-thread"}'
printf '%s\n' '{"type":"turn.completed","usage":{}}'
printf '%s\n' 'fixture marketplace warning' >&2
`,
  );
  return { bin, log };
}

describe('headless Codex activation check', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories) rmSync(directory, { recursive: true, force: true });
    directories.length = 0;
  });

  it('proves all hooks without clearing activation for a running install-time host', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-headless-codex-'));
    directories.push(directory);
    const projectRoot = nodePath.join(directory, 'project');
    const codexHome = nodePath.join(directory, 'profile');
    mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(projectRoot, '.safeword/config.json'), '{}\n');
    const fakeCodex = installFakeCodex(directory);
    const environment = {
      CODEX_HOME: codexHome,
      PATH: `${fakeCodex.bin}:${process.env.PATH ?? ''}`,
      SAFEWORD_BUN: process.execPath,
      SAFEWORD_CLI_PATH: CLI_PATH,
      SAFEWORD_CODEX_LOG: fakeCodex.log,
      SAFEWORD_FAKE_HOST_PID: String(OLD_HOST.pid),
      TZ: 'UTC',
    };
    const activationId = 'activation-stale-host';
    writeCodexActivationMarker(environment, new Date('2026-08-03T00:01:00.000Z'), {
      activationId,
      activeHosts: [OLD_HOST],
    });

    const result = runHeadlessCodexActivationCheck({
      cwd: projectRoot,
      environment,
      expectedActivation: 'pending',
      expectedActivationId: activationId,
    });

    expect(result).toMatchObject({
      activation: 'pending',
      codexVersion: 'codex-cli 0.144.5',
      model: DEFAULT_CODEX_ACTIVATION_CHECK_MODEL,
      warnings: ['fixture marketplace warning'],
    });
    expect(result.proof.events).toEqual(CODEX_PLUGIN_HOOK_EVENTS);
    expect(readFileSync(fakeCodex.log, 'utf8')).toContain(
      `-m ${DEFAULT_CODEX_ACTIVATION_CHECK_MODEL}`,
    );
    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'))).toBe(true);
    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-current-v1.json'))).toBe(false);
  });
});
