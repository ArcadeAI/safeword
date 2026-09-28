import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

afterAll(cleanupTrustedReviewerDirectories);

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
}

function fakeReviewer(): string {
  const root = createTrustedReviewerDirectory('safeword-generated-review-');
  const bin = nodePath.join(root, 'bin');
  mkdirSync(bin);
  const executable = nodePath.join(bin, 'codex');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${REVIEWER_CAPABILITIES.codex}'
  exit 0
fi
payload=$(cat)
printf '%s' "$payload" > "$SAFEWORD_REVIEW_PROMPT_LOG"
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^" ]*\)".*/\1/p')
escaped=$(printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"codex","verdict":"approve","summary":"reviewed","findings":[]}' "$dispatch_id" | sed 's/"/\\"/g')
printf '{"type":"item.completed","item":{"id":"i0","type":"agent_message","text":"%s"}}\n' "$escaped"
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

describe('generated review targets', () => {
  it('reviews authored input while reporting both generated targets one byte over the limit', async () => {
    const directory = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    writeFileSync(nodePath.join(directory, 'authored.md'), 'review this authored change\n');
    mkdirSync(nodePath.join(directory, 'generated'));
    for (const name of ['first.js', 'second.js']) {
      writeFileSync(nodePath.join(directory, 'generated', name), 'x'.repeat(256 * 1024 + 1));
    }
    writeFileSync(
      nodePath.join(directory, '.gitattributes'),
      'generated/** linguist-generated=true\n',
    );
    git(directory, 'init', '-q');
    git(directory, 'add', '.gitattributes', 'authored.md');
    git(
      directory,
      '-c',
      'commit.gpgsign=false',
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-qm',
      'fixture',
    );
    const bin = fakeReviewer();

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'authored.md',
        'generated/first.js',
        'generated/second.js',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: {
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_PROMPT_LOG: promptLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    const envelope = JSON.parse(result.stdout) as { data: { excluded_targets: string[] } };
    expect(envelope.data.excluded_targets).toEqual(['generated/first.js', 'generated/second.js']);
    const prompt = readFileSync(promptLog, 'utf8');
    expect(prompt).toContain('review this authored change');
    expect(prompt).not.toContain('generated/first.js');
    expect(prompt).not.toContain('generated/second.js');
  });

  it('rejects an unmarked oversized runtime-shaped file with the size-limit code', async () => {
    const directory = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    const runtime = nodePath.join(directory, 'plugin', 'runtime');
    mkdirSync(runtime, { recursive: true });
    writeFileSync(nodePath.join(directory, 'authored.md'), 'review this authored change\n');
    writeFileSync(nodePath.join(runtime, 'cli.js'), 'x'.repeat(256 * 1024 + 1));
    writeFileSync(nodePath.join(directory, '.gitattributes'), 'other/** linguist-generated=true\n');
    git(directory, 'init', '-q');
    git(directory, 'add', '.gitattributes', 'authored.md');
    git(
      directory,
      '-c',
      'commit.gpgsign=false',
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-qm',
      'fixture',
    );
    const bin = fakeReviewer();

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'authored.md',
        'plugin/runtime/cli.js',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: {
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_PROMPT_LOG: promptLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode).not.toBe(0);
    const envelope = JSON.parse(result.stdout) as {
      errors: { code: string }[];
      data: { excluded_targets?: string[] };
    };
    expect(envelope.errors[0]?.code).toBe('REVIEW_TARGET_TOO_LARGE');
    expect(envelope.data.excluded_targets).toBeUndefined();
    expect(existsSync(promptLog)).toBe(false);
  });

  it('rejects a target reached through an intermediate symlink outside the project', async () => {
    const directory = createTemporaryDirectory();
    const outside = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    mkdirSync(nodePath.join(outside, 'generated'));
    writeFileSync(nodePath.join(outside, 'generated', 'output.js'), 'outside content\n');
    symlinkSync(outside, nodePath.join(directory, 'link'), 'dir');
    const bin = fakeReviewer();

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'link/generated/output.js',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: {
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_PROMPT_LOG: promptLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode).not.toBe(0);
    const envelope = JSON.parse(result.stdout) as {
      errors: { code: string }[];
      data: { excluded_targets?: string[] };
    };
    expect(envelope.errors[0]?.code).toBe('REVIEW_TARGET_OUTSIDE_PROJECT');
    expect(envelope.data.excluded_targets).toBeUndefined();
    expect(existsSync(promptLog)).toBe(false);
  });

  it('reports invalid UTF-8 as a typed preflight failure without launching a reviewer', async () => {
    const directory = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    writeFileSync(nodePath.join(directory, 'invalid.md'), Buffer.from([0xff]));
    const bin = fakeReviewer();

    const result = await runCli(
      ['review', 'run', 'quality-review', 'invalid.md', '--json', '--no-input', '--cwd', directory],
      {
        cwd: directory,
        env: {
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_PROMPT_LOG: promptLog,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toBe('');
    const envelope = JSON.parse(result.stdout) as {
      errors: { code: string }[];
      data: { excluded_targets?: string[] };
    };
    expect(envelope.errors[0]?.code).toBe('REVIEW_TARGET_INVALID_TEXT');
    expect(envelope.data.excluded_targets).toBeUndefined();
    expect(existsSync(promptLog)).toBe(false);
  });
});
