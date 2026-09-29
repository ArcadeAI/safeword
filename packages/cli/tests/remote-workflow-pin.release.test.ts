import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const workflow = readFileSync(
  nodePath.join(packageRoot, 'templates/workflows/remote-tests.yml'),
  'utf8',
);

function testCommand(): string {
  const document = parseDocument(workflow).toJS() as {
    jobs: { test: { steps: { id?: string; run?: string }[] } };
  };
  const command = document.jobs.test.steps.find(step => step.id === 'tests')?.run;
  if (command === undefined) throw new Error('remote test command is missing');
  return command;
}

function runWithProjectVersion(version?: string): {
  status: number | null;
  args: string | undefined;
} {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-remote-version-'));
  try {
    const bin = nodePath.join(root, 'bin');
    mkdirSync(bin);
    mkdirSync(nodePath.join(root, '.safeword'));
    if (version !== undefined) writeFileSync(nodePath.join(root, '.safeword/version'), version);
    const log = nodePath.join(root, 'npx-args');
    const npx = nodePath.join(bin, 'npx');
    writeFileSync(npx, '#!/bin/sh\nprintf "%s\\n" "$@" > "$SAFEWORD_NPX_LOG"\n');
    chmodSync(npx, 0o755);

    const result = spawnSync('bash', ['-e', '-c', testCommand()], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        LANE: 'done',
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        SAFEWORD_NPX_LOG: log,
      },
    });
    const args = result.status === 0 ? readFileSync(log, 'utf8') : undefined;
    return { status: result.status, args };
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

describe('remote-test workflow version selection', () => {
  it.each(['0.85.0', '1.0.0-rc.5'])('runs the checked-out project version %s', version => {
    expect(runWithProjectVersion(`${version}\n`)).toEqual({
      status: 0,
      args: `--yes\nsafeword@${version}\nproject\ntest\n--lane\ndone\n--execution\nlocal\n--prepare-remote\n`,
    });
  });

  it.each([undefined, 'latest\n', '0.85.0;touch /tmp/unsafe\n'])(
    'fails closed for an absent or unsafe version marker',
    version => {
      expect(runWithProjectVersion(version)).toEqual({ status: 1, args: undefined });
    },
  );
});
