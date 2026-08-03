/* eslint-disable unicorn/no-null -- transaction JSON uses null for an absent file image */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { recoverClaudeCleanup } from '../../src/claude-plugin/cleanup.js';

const fixtures: string[] = [];

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function fixture(): { root: string; target: string; transaction: string } {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-recovery-'));
  fixtures.push(root);
  const target = nodePath.join(root, '.claude/skills/debug/SKILL.md');
  const transaction = nodePath.join(root, '.safeword/claude-plugin/cleanup-transaction-v1.json');
  mkdirSync(nodePath.dirname(target), { recursive: true });
  mkdirSync(nodePath.dirname(transaction), { recursive: true });
  return { root, target, transaction };
}

function writeTransaction(
  path: string,
  disposition: 'complete-forward' | 'restore-backup',
  before: string,
): void {
  writeFileSync(
    path,
    `${JSON.stringify({
      schema_version: 1,
      transaction_id: '00000000-0000-4000-8000-000000000000',
      disposition,
      entries: [
        {
          path: '.claude/skills/debug/SKILL.md',
          before_sha256: sha256(before),
          before_base64: Buffer.from(before).toString('base64'),
          before_mode: 0o644,
          after_sha256: null,
          after_base64: null,
          after_mode: null,
        },
      ],
    })}\n`,
  );
}

afterEach(() => {
  const completed = [...fixtures];
  fixtures.length = 0;
  for (const root of completed) rmSync(root, { recursive: true, force: true });
});

describe('Claude cleanup recovery', () => {
  it('completes the recorded forward image only from the recorded before fingerprint', () => {
    const { root, target, transaction } = fixture();
    writeFileSync(target, 'recognized legacy\n');
    writeTransaction(transaction, 'complete-forward', 'recognized legacy\n');

    expect(recoverClaudeCleanup(root).state).toBe('changed');
    expect(existsSync(target)).toBe(false);
    expect(existsSync(transaction)).toBe(false);
  });

  it('restores the durable backup only from the recorded after fingerprint', () => {
    const { root, target, transaction } = fixture();
    writeTransaction(transaction, 'restore-backup', 'recognized legacy\n');

    expect(recoverClaudeCleanup(root).state).toBe('changed');
    expect(readFileSync(target, 'utf8')).toBe('recognized legacy\n');
  });

  it('preserves unknown concurrent bytes and retains recovery evidence', () => {
    const { root, target, transaction } = fixture();
    writeFileSync(target, 'concurrent user bytes\n');
    writeTransaction(transaction, 'complete-forward', 'recognized legacy\n');

    const result = recoverClaudeCleanup(root);
    expect(result.state).toBe('failed');
    expect(readFileSync(target, 'utf8')).toBe('concurrent user bytes\n');
    expect(existsSync(transaction)).toBe(true);
  });

  it('refuses a symlinked managed target before mutation', () => {
    const { root, target, transaction } = fixture();
    const external = nodePath.join(root, 'external');
    writeFileSync(external, 'external bytes\n');
    symlinkSync(external, target);
    writeTransaction(transaction, 'complete-forward', 'external bytes\n');

    expect(recoverClaudeCleanup(root).state).toBe('failed');
    expect(readFileSync(external, 'utf8')).toBe('external bytes\n');
  });

  it('is a healthy no-op after recovery has completed', () => {
    const { root } = fixture();
    expect(recoverClaudeCleanup(root).state).toBe('healthy');
  });
});
