import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  const root = createTrustedReviewerDirectory('safeword-generated-repetition-');
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

describe('generated review repetition', () => {
  it('reports one ordered exclusion when a generated target is repeated', async () => {
    const directory = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    writeFileSync(nodePath.join(directory, 'authored.md'), 'review this authored change\n');
    mkdirSync(nodePath.join(directory, 'generated'));
    writeFileSync(nodePath.join(directory, 'generated', 'output.js'), 'x'.repeat(256 * 1024 + 1));
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
        'generated/output.js',
        'generated/output.js',
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

    const envelope = JSON.parse(result.stdout) as {
      data?: { excluded_targets?: string[] };
      errors?: { code: string }[];
    };
    const prompt = existsSync(promptLog) ? readFileSync(promptLog, 'utf8') : '';
    const packetMarker = '\n{"schema_version":';
    const packetStart = prompt.lastIndexOf(packetMarker);
    const packet =
      packetStart === -1
        ? undefined
        : (JSON.parse(prompt.slice(packetStart + 1).trimEnd()) as {
            logical_files: { path: string; content: string }[];
          });
    expect({
      excludedTargets: envelope.data?.excluded_targets,
      exitCode: result.exitCode,
      errors: envelope.errors,
      reviewerFiles: packet?.logical_files,
    }).toEqual({
      excludedTargets: ['generated/output.js'],
      exitCode: 0,
      errors: [],
      reviewerFiles: [{ path: 'authored.md', content: 'review this authored change\n' }],
    });
  });
});
