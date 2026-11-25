import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { REVIEWER_CAPABILITIES } from '../review-fixtures.js';

/** External reviewer-process control only. Never actual model/calibration evidence. */
export function controlledGrader(root: string, settings: Record<string, unknown> = {}) {
  const repo = path.resolve(import.meta.dirname, '../../../..');
  const cache = path.join(repo, 'node_modules/.cache');
  mkdirSync(cache, { recursive: true });
  const bin = mkdtempSync(path.join(cache, 'grader-control-'));
  const authProfile = path.join(root, 'control-auth');
  mkdirSync(authProfile);
  writeFileSync(path.join(authProfile, 'auth.json'), '{"nonreceipt":"opaque-control"}', {
    mode: 0o600,
  });
  const source = path.join(
    repo,
    'packages/cli/tests/fixtures/host-contract/isolated-grader-reviewer.cjs',
  );
  writeFileSync(path.join(bin, 'codex'), `#!${process.execPath}\n${readFileSync(source, 'utf8')}`);
  chmodSync(path.join(bin, 'codex'), 0o700);
  writeFileSync(
    path.join(bin, 'control.json'),
    JSON.stringify({ fault: 'ok', help: REVIEWER_CAPABILITIES.codex, ...settings }),
  );
  const mise = spawnSync('/bin/sh', ['-c', 'command -v mise'], { encoding: 'utf8' });
  assert.equal(mise.status, 0);
  symlinkSync(mise.stdout.trim(), path.join(bin, 'mise'));
  const originalState = process.env.XDG_STATE_HOME ?? path.join(homedir(), '.local/state');
  return {
    bin,
    authProfile,
    environment: {
      ...process.env,
      CODEX_HOME: authProfile,
      PATH: `${bin}:/usr/bin:/bin`,
      MISE_STATE_DIR: process.env.MISE_STATE_DIR ?? path.join(originalState, 'mise'),
      SAFEWORD_REVIEW_FOREGROUND_MS: '10000',
      SAFEWORD_REVIEW_TIMEOUT_MS: '1200',
      SAFEWORD_REVIEW_RUN_BOUND_MS: '4000',
    },
  };
}
