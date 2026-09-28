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

function failingReviewer(): string {
  const root = createTrustedReviewerDirectory('safeword-generated-review-failure-');
  const bin = nodePath.join(root, 'bin');
  mkdirSync(bin);
  const executable = nodePath.join(bin, 'codex');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${REVIEWER_CAPABILITIES.codex}'
  exit 0
fi
exit 7
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

  it('rejects a final-component symlink outside the project with the containment code', async () => {
    const directory = createTemporaryDirectory();
    const outside = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    const outsideFile = nodePath.join(outside, 'output.js');
    writeFileSync(outsideFile, 'outside content\n');
    symlinkSync(outsideFile, nodePath.join(directory, 'link.js'));
    const bin = fakeReviewer();

    const result = await runCli(
      ['review', 'run', 'quality-review', 'link.js', '--json', '--no-input', '--cwd', directory],
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

  it('rejects malformed Git attribute bytes before omitting an oversized target', async () => {
    const directory = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    writeFileSync(nodePath.join(directory, 'authored.md'), 'review this\n');
    writeFileSync(nodePath.join(directory, 'large.js'), 'x'.repeat(256 * 1024 + 1));
    writeFileSync(nodePath.join(directory, '.gitattributes'), 'large.js linguist-generated=true\n');
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
    const gitExecutable = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
    expect(gitExecutable).not.toBe('');
    const bin = fakeReviewer();
    const fakeGit = nodePath.join(bin, 'git');
    writeFileSync(
      fakeGit,
      String.raw`#!/bin/sh
for argument in "$@"; do
  if [ "$argument" = check-attr ]; then
    printf 'large.js\000linguist-generated\000\377\000'
    exit 0
  fi
done
exec "${gitExecutable}" "$@"
`,
      { mode: 0o755 },
    );
    chmodSync(fakeGit, 0o755);

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'authored.md',
        'large.js',
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
    expect(envelope.errors[0]?.code).toBe('REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE');
    expect(envelope.data.excluded_targets).toBeUndefined();
    expect(existsSync(promptLog)).toBe(false);
  });

  it.each([
    { targets: ['invalid.md', 'large.js'], code: 'REVIEW_TARGET_INVALID_TEXT' },
    { targets: ['large.js', 'invalid.md'], code: 'REVIEW_TARGET_TOO_LARGE' },
  ])('reports the first target failure for $targets', async ({ targets, code }) => {
    const directory = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    writeFileSync(nodePath.join(directory, 'invalid.md'), Buffer.from([0xff]));
    writeFileSync(nodePath.join(directory, 'large.js'), 'x'.repeat(256 * 1024 + 1));
    writeFileSync(nodePath.join(directory, '.gitattributes'), 'other/** linguist-generated=true\n');
    git(directory, 'init', '-q');
    git(directory, 'add', '.gitattributes');
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
      ['review', 'run', 'quality-review', ...targets, '--json', '--no-input', '--cwd', directory],
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
    expect(envelope.errors[0]?.code).toBe(code);
    expect(envelope.data.excluded_targets).toBeUndefined();
    expect(existsSync(promptLog)).toBe(false);
  });

  it.each(['plugin/runtime/cli.js', 'packages/cli/codex-plugin/runtime/cli.js'])(
    'reviews authored input beside the shipped generated runtime %s',
    async runtime => {
      const project = nodePath.resolve(process.cwd(), '../..');
      const directory = createTemporaryDirectory();
      const promptLog = nodePath.join(directory, 'prompt.log');
      const bin = fakeReviewer();

      const result = await runCli(
        [
          'review',
          'run',
          'quality-review',
          'README.md',
          runtime,
          '--json',
          '--no-input',
          '--cwd',
          project,
        ],
        {
          cwd: project,
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
      expect(envelope.data.excluded_targets).toEqual([runtime]);
      const prompt = readFileSync(promptLog, 'utf8');
      expect(prompt).toContain('# SAFEWORD - AI Agent Configuration CLI');
      expect(prompt).not.toContain(runtime);
    },
  );

  it('keeps a generated target below the individual limit in the reviewer packet', async () => {
    const directory = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    writeFileSync(nodePath.join(directory, 'small.js'), 'generated but reviewable\n');
    writeFileSync(nodePath.join(directory, '.gitattributes'), 'small.js linguist-generated=true\n');
    const bin = fakeReviewer();

    const result = await runCli(
      ['review', 'run', 'quality-review', 'small.js', '--json', '--no-input', '--cwd', directory],
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
    expect(envelope.data.excluded_targets).toEqual([]);
    expect(readFileSync(promptLog, 'utf8')).toContain('generated but reviewable');
  });

  it.each([
    { label: 'all generated targets excluded', targets: ['plugin/runtime/cli.js'] },
    { label: 'no submitted targets', targets: [] },
  ])('refuses $label before reviewer launch', async ({ targets }) => {
    const project = nodePath.resolve(process.cwd(), '../..');
    const directory = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    const bin = fakeReviewer();

    const result = await runCli(
      ['review', 'run', 'quality-review', ...targets, '--json', '--no-input', '--cwd', project],
      {
        cwd: project,
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
    expect(envelope.errors[0]?.code).toBe('REVIEW_NO_ELIGIBLE_TARGETS');
    expect(envelope.data.excluded_targets).toBeUndefined();
    expect(existsSync(promptLog)).toBe(false);
  });

  it('rejects an oversized target that becomes an outside symlink during classification', async () => {
    const directory = createTemporaryDirectory();
    const outside = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    const generated = nodePath.join(directory, 'large.js');
    const outsideFile = nodePath.join(outside, 'large.js');
    writeFileSync(nodePath.join(directory, 'authored.md'), 'review this\n');
    writeFileSync(generated, 'x'.repeat(256 * 1024 + 1));
    writeFileSync(outsideFile, 'outside\n');
    writeFileSync(nodePath.join(directory, '.gitattributes'), 'large.js linguist-generated=true\n');
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
    const gitExecutable = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
    expect(gitExecutable).not.toBe('');
    const bin = fakeReviewer();
    const fakeGit = nodePath.join(bin, 'git');
    writeFileSync(
      fakeGit,
      `#!/bin/sh
for argument in "$@"; do
  if [ "$argument" = check-attr ]; then
    "${gitExecutable}" "$@"
    status=$?
    /bin/mv "${generated}" "${generated}.old"
    /bin/ln -s "${outsideFile}" "${generated}"
    exit "$status"
  fi
done
exec "${gitExecutable}" "$@"
`,
      { mode: 0o755 },
    );
    chmodSync(fakeGit, 0o755);

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'authored.md',
        'large.js',
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

  it('uses committed generated status despite local Git info and working-tree overrides', async () => {
    const directory = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    mkdirSync(nodePath.join(directory, 'generated'));
    writeFileSync(nodePath.join(directory, 'authored.md'), 'review committed policy\n');
    writeFileSync(nodePath.join(directory, 'generated', 'large.js'), 'x'.repeat(256 * 1024 + 1));
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
    writeFileSync(
      nodePath.join(directory, '.git', 'info', 'attributes'),
      'generated/** -linguist-generated\n',
    );
    writeFileSync(nodePath.join(directory, '.gitattributes'), 'generated/** -linguist-generated\n');
    const bin = fakeReviewer();

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'authored.md',
        'generated/large.js',
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
          GIT_DIR: nodePath.join(directory, 'missing-git-dir'),
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    const envelope = JSON.parse(result.stdout) as { data: { excluded_targets: string[] } };
    expect(envelope.data.excluded_targets).toEqual(['generated/large.js']);
    expect(readFileSync(promptLog, 'utf8')).toContain('review committed policy');
  });

  it('does not let uncommitted attribute additions make an oversized target omittable', async () => {
    const directory = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    mkdirSync(nodePath.join(directory, 'generated'));
    writeFileSync(nodePath.join(directory, 'authored.md'), 'review committed policy\n');
    writeFileSync(nodePath.join(directory, 'generated', 'large.js'), 'x'.repeat(256 * 1024 + 1));
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
    writeFileSync(
      nodePath.join(directory, '.git', 'info', 'attributes'),
      'generated/** linguist-generated=true\n',
    );
    writeFileSync(
      nodePath.join(directory, '.gitattributes'),
      'generated/** linguist-generated=true\n',
    );
    const bin = fakeReviewer();

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'authored.md',
        'generated/large.js',
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
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'core.attributesFile',
          GIT_CONFIG_VALUE_0: nodePath.join(directory, '.git', 'info', 'attributes'),
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

  it('retains the excluded target list when the reviewer route fails', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'authored.md'), 'review this\n');
    writeFileSync(nodePath.join(directory, 'large.js'), 'x'.repeat(256 * 1024 + 1));
    writeFileSync(nodePath.join(directory, '.gitattributes'), 'large.js linguist-generated=true\n');
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
    const bin = failingReviewer();

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'authored.md',
        'large.js',
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
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode).not.toBe(0);
    const envelope = JSON.parse(result.stdout) as {
      data: { excluded_targets?: string[]; status?: string };
    };
    expect(envelope.data.status).not.toBe('approved');
    expect(envelope.data.excluded_targets).toEqual(['large.js']);
  });

  it.each([
    { extraByte: false, label: 'exact serialized packet boundary' },
    { extraByte: true, label: 'one byte beyond the serialized packet boundary' },
  ])('keeps the aggregate limit with generated omission at $label', async ({ extraByte }) => {
    const directory = createTemporaryDirectory();
    const promptLog = nodePath.join(directory, 'prompt.log');
    const paths = ['first.md', 'second.md', 'third.md', 'fourth.md'];
    const contents = paths.map(() => 'é'.repeat(131_000));
    const examplePacket = {
      schema_version: 1,
      dispatch_id: '0'.repeat(36),
      kind: 'quality-review',
      logical_files: paths.map((path, index) => ({ path, content: contents[index] })),
    };
    let remaining = 1024 * 1024 - Buffer.byteLength(JSON.stringify(examplePacket), 'utf8');
    expect(remaining).toBeGreaterThanOrEqual(0);
    for (const index of paths.keys()) {
      const fill = Math.min(144, remaining);
      contents[index] = (contents[index] ?? '') + 'x'.repeat(fill);
      remaining -= fill;
    }
    expect(remaining).toBe(0);
    const boundaryPacket = {
      ...examplePacket,
      logical_files: paths.map((path, index) => ({ path, content: contents[index] })),
    };
    const boundaryBytes = Buffer.byteLength(JSON.stringify(boundaryPacket), 'utf8');
    expect(boundaryBytes).toBe(1024 * 1024);
    if (extraByte) {
      const index = contents.findIndex(content => Buffer.byteLength(content, 'utf8') < 256 * 1024);
      expect(index).toBeGreaterThanOrEqual(0);
      contents[index] = `${contents[index] ?? ''}x`;
    }
    for (const [index, path] of paths.entries()) {
      const content = contents[index];
      if (content === undefined) throw new Error(`Missing aggregate fixture for ${path}`);
      writeFileSync(nodePath.join(directory, path), content);
    }
    writeFileSync(nodePath.join(directory, 'generated.js'), 'x'.repeat(256 * 1024 + 1));
    writeFileSync(
      nodePath.join(directory, '.gitattributes'),
      'generated.js linguist-generated=true\n',
    );
    git(directory, 'init', '-q');
    git(directory, 'add', '.gitattributes');
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
        ...paths,
        'generated.js',
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
      errors: { code: string }[];
      data: { excluded_targets?: string[] };
    };
    if (extraByte) {
      expect(result.exitCode).not.toBe(0);
      expect(envelope.errors[0]?.code).toBe('REVIEW_PACKET_TOO_LARGE');
      expect(envelope.data.excluded_targets).toBeUndefined();
      expect(existsSync(promptLog)).toBe(false);
    } else {
      expect(result.exitCode, result.stdout).toBe(0);
      expect(envelope.data.excluded_targets).toEqual(['generated.js']);
      expect(readFileSync(promptLog, 'utf8')).toContain('first.md');
      expect(readFileSync(promptLog, 'utf8')).not.toContain('generated.js');
    }
  });
});
