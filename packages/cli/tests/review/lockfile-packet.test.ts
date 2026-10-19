import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';
import { largeLockfileFixture } from '../helpers/large-lockfile.js';

const directories: string[] = [];
function temporaryDirectory(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-lock-packet-'));
  directories.push(root);
  return root;
}
function fixture(attributes?: string) {
  return largeLockfileFixture(temporaryDirectory(), attributes);
}
const digest = (text: string): string => createHash('sha256').update(text).digest('hex');

afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('bounded logical review of large lockfile changes', () => {
  it.each(['unstaged', 'staged', 'committed'])(
    'reviews a %s version edit as the original logical file',
    state => {
      const f = fixture();
      const source = f.before.replace('1.1.0', '1.2.0');
      f.write(source);
      if (state !== 'unstaged') f.git('add', 'bun.lock');
      if (state === 'committed') f.commit('version');
      const p = prepareReviewPacket(f.root, 'quality-review', ['bun.lock']);
      try {
        expect(p.packet.logical_files).toHaveLength(1);
        expect(p.packet.logical_files[0]).toMatchObject({
          path: 'bun.lock',
          representation: {
            kind: 'git-diff',
            base_ref: 'refs/remotes/origin/main',
            base_commit: f.baseline,
            base_path: 'bun.lock',
            base_sha256: digest(f.before),
            source_sha256: digest(source),
            source_bytes: Buffer.byteLength(source),
          },
        });
        expect(p.packet.logical_files[0]?.content).toContain('-      "version": "1.1.0"');
        expect(p.packet.logical_files[0]?.content).toContain('+      "version": "1.2.0"');
        expect(p.excludedTargets).toEqual([]);
        expect(p.sourceChanged()).toBe(false);
        expect(p.snapshotChanged()).toBe(false);
      } finally {
        p.cleanup();
      }
    },
  );

  it('retains committed resolution edits when local main is ahead of the remote', () => {
    const f = fixture();
    const lock = JSON.parse(f.before);
    lock.packages['dependency-3000'].version = '3.0.0';
    const committed = `${JSON.stringify(lock, undefined, 2)}\n`;
    f.write(committed);
    f.git('add', 'bun.lock');
    f.commit('resolution');
    f.git('update-ref', 'refs/heads/main', 'HEAD');
    f.write(committed.replace('1.1.0', '1.2.0'));
    const p = prepareReviewPacket(f.root, 'quality-review', ['bun.lock']);
    try {
      expect(p.packet.logical_files[0]).toMatchObject({
        representation: { base_commit: f.baseline },
      });
      expect(p.packet.logical_files[0]?.content).toContain('+      "version": "3.0.0"');
      expect(p.packet.logical_files[0]?.content).toContain('+      "version": "1.2.0"');
    } finally {
      p.cleanup();
    }
  });

  it('reconstructs every authored change from a displayed patch larger than 16 KiB', () => {
    const f = fixture('bun.lock -diff\n');
    const lock = JSON.parse(f.before);
    for (let index = 0; index < 800; index++) {
      lock.packages[`dependency-${index}`].version = '2.0.0';
    }
    const source = `${JSON.stringify(lock, undefined, 2)}\n`;
    f.write(source);
    const p = prepareReviewPacket(f.root, 'quality-review', ['bun.lock']);
    try {
      const patch = p.packet.logical_files[0]?.content ?? '';
      expect(Buffer.byteLength(patch)).toBeGreaterThan(16_384);
      const replay = temporaryDirectory();
      writeFileSync(nodePath.join(replay, 'bun.lock'), f.before);
      const initialized = spawnSync('git', ['init', '-q'], { cwd: replay });
      expect(initialized.status).toBe(0);
      const applied = spawnSync('git', ['apply', '-p1', '-'], {
        cwd: replay,
        input: patch,
        encoding: 'utf8',
      });
      expect(applied.status, applied.stderr).toBe(0);
      expect(readFileSync(nodePath.join(replay, 'bun.lock'), 'utf8')).toBe(source);
      expect(patch).toContain('"dependency-799"');
    } finally {
      p.cleanup();
    }
  });

  it('detects an edit outside the original displayed hunks', () => {
    const f = fixture();
    const source = f.before.replace('1.1.0', '1.2.0');
    f.write(source);
    const p = prepareReviewPacket(f.root, 'quality-review', ['bun.lock']);
    try {
      expect(p.sourceChanged()).toBe(false);
      const changed = JSON.parse(source);
      changed.packages['dependency-5999'].version = '9.0.0';
      f.write(`${JSON.stringify(changed, undefined, 2)}\n`);
      expect(p.sourceChanged()).toBe(true);
      expect(p.snapshotChanged()).toBe(false);
    } finally {
      p.cleanup();
    }
  });

  it('detects modification of the bounded reviewer snapshot', () => {
    const f = fixture();
    f.write(f.before.replace('1.1.0', '1.2.0'));
    const p = prepareReviewPacket(f.root, 'quality-review', ['bun.lock']);
    try {
      writeFileSync(nodePath.join(p.workspace, 'bun.lock'), 'changed patch\n');
      expect(p.snapshotChanged()).toBe(true);
      expect(p.sourceChanged()).toBe(false);
    } finally {
      p.cleanup();
    }
  });

  it('invalidates captured provenance when an identical-blob baseline advances', () => {
    const f = fixture();
    f.write(f.before.replace('1.1.0', '1.2.0'));
    const p = prepareReviewPacket(f.root, 'quality-review', ['bun.lock']);
    try {
      f.commit('same-tree baseline advance', true);
      f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      const later = prepareReviewPacket(f.root, 'quality-review', ['bun.lock']);
      try {
        expect(later.packet.logical_files[0]?.content).toBe(p.packet.logical_files[0]?.content);
        expect(p.sourceChanged()).toBe(true);
      } finally {
        later.cleanup();
      }
    } finally {
      p.cleanup();
    }
  });

  it.skipIf(process.platform === 'win32')('detects an executable-mode change after capture', () => {
    const f = fixture();
    f.write(f.before.replace('1.1.0', '1.2.0'));
    const p = prepareReviewPacket(f.root, 'quality-review', ['bun.lock']);
    try {
      chmodSync(nodePath.join(f.root, 'bun.lock'), 0o755);
      expect(p.sourceChanged()).toBe(true);
    } finally {
      p.cleanup();
    }
  });

  it('resolves a nested project root to its original Git blob', () => {
    const f = fixture();
    const nested = nodePath.join(f.root, 'app');
    mkdirSync(nested);
    f.git('mv', 'bun.lock', 'app/bun.lock');
    f.commit('nested project');
    f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    writeFileSync(nodePath.join(nested, 'bun.lock'), f.before.replace('1.1.0', '1.2.0'));
    const p = prepareReviewPacket(nested, 'quality-review', ['bun.lock']);
    try {
      expect(p.packet.logical_files[0]).toMatchObject({
        path: 'bun.lock',
        representation: { base_path: 'app/bun.lock' },
      });
      expect(p.sourceChanged()).toBe(false);
    } finally {
      p.cleanup();
    }
  });

  it.each(['space here', 'café', 'quote"here', 'tab\there', 'back\bspace', 'form\ffeed'])(
    'reconstructs the displayed patch under directory %j',
    directory => {
      const f = fixture();
      mkdirSync(nodePath.join(f.root, directory));
      const target = `${directory}/bun.lock`;
      f.git('mv', 'bun.lock', target);
      f.commit('quoted path baseline');
      f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      const source = f.before.replace('1.1.0', '1.2.0');
      writeFileSync(nodePath.join(f.root, target), source);
      const p = prepareReviewPacket(f.root, 'quality-review', [target]);
      try {
        expect(p.packet.logical_files[0]).toMatchObject({
          path: target,
          representation: { base_path: target, source_sha256: digest(source) },
        });
        expect(p.sourceChanged()).toBe(false);
      } finally {
        p.cleanup();
      }
    },
  );

  it('ignores repository diff drivers, filters and external attributes during projection', () => {
    const f = fixture('bun.lock diff=hostile filter=hostile\n');
    const marker = nodePath.join(f.root, 'driver-ran');
    const driver = nodePath.join(f.root, 'driver.cjs');
    writeFileSync(
      driver,
      `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed'); process.stdout.write('hidden');`,
    );
    const command = `node "${driver}"`;
    f.git('config', 'diff.external', command);
    f.git('config', 'diff.hostile.textconv', command);
    f.git('config', 'filter.hostile.clean', command);
    f.git('config', 'filter.hostile.smudge', command);
    const attributes = nodePath.join(f.root, 'external-attributes');
    writeFileSync(attributes, 'bun.lock -diff\n');
    f.git('config', 'core.attributesFile', attributes);
    f.write(f.before.replace('1.1.0', '1.2.0'));
    const p = prepareReviewPacket(f.root, 'quality-review', ['bun.lock']);
    try {
      const patch = p.packet.logical_files[0]?.content ?? '';
      expect(patch).toContain('+      "version": "1.2.0"');
      expect(patch).toContain('-      "version": "1.1.0"');
      expect(p.sourceChanged()).toBe(false);
      expect(() => readFileSync(marker)).toThrow(/ENOENT/u);
    } finally {
      p.cleanup();
    }
  });

  it('preserves authenticated generated-file exclusion ahead of projection', () => {
    const f = fixture('bun.lock linguist-generated=true\n');
    f.write(f.before.replace('1.1.0', '1.2.0'));
    writeFileSync(nodePath.join(f.root, 'input.md'), 'review this\n');
    const p = prepareReviewPacket(f.root, 'quality-review', ['input.md', 'bun.lock']);
    try {
      expect(p.packet.logical_files).toEqual([{ path: 'input.md', content: 'review this\n' }]);
      expect(p.excludedTargets).toEqual(['bun.lock']);
    } finally {
      p.cleanup();
    }
  });

  it('keeps oversized tracked source files outside the projection path', () => {
    const f = fixture();
    const target = nodePath.join(f.root, 'source.ts');
    writeFileSync(target, f.before);
    f.git('add', 'source.ts');
    f.commit('source baseline');
    f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    writeFileSync(target, f.before.replace('1.1.0', '1.2.0'));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['source.ts'])).toThrow(
      expect.objectContaining({ code: 'REVIEW_TARGET_TOO_LARGE' }),
    );
  });

  it('retains the full-text context limit', () => {
    const f = fixture();
    f.write(f.before.replace('1.1.0', '1.2.0'));
    writeFileSync(nodePath.join(f.root, 'input.md'), 'review this\n');
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['input.md'], ['bun.lock'])).toThrow(
      expect.objectContaining({ code: 'REVIEW_TARGET_TOO_LARGE' }),
    );
  });

  it('retains the full-text limit for other review kinds', () => {
    const f = fixture();
    f.write(f.before.replace('1.1.0', '1.2.0'));
    expect(() => prepareReviewPacket(f.root, 'retrospective-proof', ['bun.lock'])).toThrow(
      expect.objectContaining({ code: 'REVIEW_TARGET_TOO_LARGE' }),
    );
  });

  it.each([8 * 1024 * 1024 - 1, 8 * 1024 * 1024])(
    'reviews a bounded edit with %i source and baseline bytes',
    size => {
      const f = fixture();
      const lock = { ...JSON.parse(f.before), padding: '' };
      const empty = `${JSON.stringify(lock, undefined, 2)}\n`;
      lock.padding = 'x'.repeat(size - Buffer.byteLength(empty));
      const baseline = `${JSON.stringify(lock, undefined, 2)}\n`;
      f.write(baseline);
      f.git('add', 'bun.lock');
      f.commit('near-limit baseline');
      f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      f.write(baseline.replace('1.1.0', '1.2.0'));
      const p = prepareReviewPacket(f.root, 'quality-review', ['bun.lock']);
      try {
        expect(p.packet.logical_files[0]).toMatchObject({
          representation: { source_bytes: size },
        });
        expect(p.packet.logical_files[0]?.content).toContain('+      "version": "1.2.0"');
        expect(p.sourceChanged()).toBe(false);
      } finally {
        p.cleanup();
      }
    },
  );

  it('rejects a source above the separate 8 MiB capture bound', () => {
    const f = fixture();
    f.write('x'.repeat(8 * 1024 * 1024 + 1));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(/8388608/u);
  });

  it('rejects an oversized patch instead of truncating it', () => {
    const f = fixture();
    f.write(f.before.replaceAll('1.0.0', '2.0.0'));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(
      expect.objectContaining({ code: 'REVIEW_TARGET_TOO_LARGE' }),
    );
  });

  it('accepts exactly 256 KiB of escaped representation and rejects one byte more', () => {
    const f = fixture();
    // Backslashes cost more in the serialized record than in the displayed patch.
    const version = `1.2.0${'\\\\'.repeat(20_000)}`;
    f.write(f.before.replace('1.1.0', () => version));
    const initial = prepareReviewPacket(f.root, 'quality-review', ['bun.lock']);
    let remaining: number;
    try {
      remaining = 256 * 1024 - Buffer.byteLength(JSON.stringify(initial.packet.logical_files[0]));
      expect(remaining).toBeGreaterThan(0);
    } finally {
      initial.cleanup();
    }
    const source = f.before.replace('1.1.0', () => `${version}${'x'.repeat(remaining)}`);
    f.write(source);
    const exact = prepareReviewPacket(f.root, 'quality-review', ['bun.lock']);
    try {
      const record = exact.packet.logical_files[0];
      expect(Buffer.byteLength(JSON.stringify(record))).toBe(256 * 1024);
      expect(Buffer.byteLength(record?.content ?? '')).toBeLessThan(256 * 1024);
      expect(record?.representation?.kind).toBe('git-diff');
    } finally {
      exact.cleanup();
    }
    f.write(source.replace('1.2.0', '1.2.0x'));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(
      /Lockfile representation exceeds the 262144-byte/u,
    );
  });

  it('rejects credentials outside the displayed context lines', () => {
    const f = fixture();
    const credential = `ghp_${'a'.repeat(40)}`;
    const lock = JSON.parse(f.before);
    lock.packages['dependency-5999'].integrity = credential;
    const baseline = `${JSON.stringify(lock, undefined, 2)}\n`;
    f.write(baseline);
    f.git('add', 'bun.lock');
    f.commit('credential fixture');
    f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    f.write(baseline.replace('1.1.0', '1.2.0'));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(
      /credential/u,
    );
  });

  it('rejects a credential removed from the baseline rather than exposing it', () => {
    const f = fixture();
    const lock = JSON.parse(f.before);
    lock.packages['dependency-5999'].integrity = `ghp_${'a'.repeat(40)}`;
    f.write(`${JSON.stringify(lock, undefined, 2)}\n`);
    f.git('add', 'bun.lock');
    f.commit('credential fixture');
    f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    f.write(f.before.replace('1.1.0', '1.2.0'));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(
      /credential/u,
    );
  });

  it('rejects invalid source encoding', () => {
    const f = fixture();
    const source = Buffer.from(f.before.replace('1.1.0', '1.2.0'));
    writeFileSync(nodePath.join(f.root, 'bun.lock'), Buffer.concat([source, Buffer.from([0xff])]));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(
      expect.objectContaining({ code: 'REVIEW_TARGET_INVALID_TEXT' }),
    );
  });

  it('fails closed when the default branch is unavailable', () => {
    const f = fixture();
    f.git('update-ref', '-d', 'refs/remotes/origin/main');
    f.git('branch', '-D', 'main');
    f.write(f.before.replace('1.1.0', '1.2.0'));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(
      expect.objectContaining({ code: 'REVIEW_LOCKFILE_DIFF_UNAVAILABLE' }),
    );
  });

  it('rejects deleted targets instead of skipping their coverage', () => {
    const f = fixture();
    unlinkSync(nodePath.join(f.root, 'bun.lock'));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(
      /exists and is readable/u,
    );
  });

  it('rejects a renamed lockfile without a baseline at its new path', () => {
    const f = fixture();
    mkdirSync(nodePath.join(f.root, 'renamed'));
    renameSync(nodePath.join(f.root, 'bun.lock'), nodePath.join(f.root, 'renamed/bun.lock'));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['renamed/bun.lock'])).toThrow(
      expect.objectContaining({ code: 'REVIEW_LOCKFILE_DIFF_UNAVAILABLE' }),
    );
  });

  it('rejects an unchanged large file rather than approving an empty view', () => {
    const f = fixture();
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(
      /No complete changed lockfile patch/u,
    );
  });

  it('does not fall back to local main when the selected remote has unrelated history', () => {
    const f = fixture();
    const tree = f.git('show', '-s', '--format=%T', f.baseline);
    const unrelated = f.git(
      '-c',
      'commit.gpgsign=false',
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      'commit-tree',
      tree,
      '-m',
      'unrelated history',
    );
    f.git('update-ref', 'refs/remotes/origin/main', unrelated);
    f.write(f.before.replace('1.1.0', '1.2.0'));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(
      expect.objectContaining({ code: 'REVIEW_LOCKFILE_DIFF_UNAVAILABLE' }),
    );
  });

  it('counts the bounded view rather than the raw source against the packet budget', () => {
    const f = fixture();
    f.write(f.before.replace('1.1.0', '1.2.0'));
    const context = ['one.md', 'two.md', 'three.md'];
    for (const file of context) writeFileSync(nodePath.join(f.root, file), 'x'.repeat(250 * 1024));
    const p = prepareReviewPacket(f.root, 'quality-review', ['bun.lock'], context);
    try {
      expect(p.packet.context_files).toHaveLength(3);
      expect(Buffer.byteLength(JSON.stringify(p.packet))).toBeLessThanOrEqual(1024 * 1024);
    } finally {
      p.cleanup();
    }
  });

  it('retains the total serialized packet limit for lockfile views', () => {
    const f = fixture();
    const lock = JSON.parse(f.before);
    for (let index = 0; index < 800; index++)
      lock.packages[`dependency-${index}`].version = '2.0.0';
    f.write(`${JSON.stringify(lock, undefined, 2)}\n`);
    const context = ['one.md', 'two.md', 'three.md', 'four.md'];
    for (const file of context) writeFileSync(nodePath.join(f.root, file), 'x'.repeat(250 * 1024));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'], context)).toThrow(
      expect.objectContaining({ code: 'REVIEW_PACKET_TOO_LARGE' }),
    );
  });

  it('rejects a baseline above the separate 8 MiB capture bound', () => {
    const f = fixture();
    f.write('x'.repeat(8 * 1024 * 1024 + 1));
    f.git('add', 'bun.lock');
    f.commit('large baseline');
    f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    f.write(f.before.replace('1.1.0', '1.2.0'));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(/8388608/u);
  });

  it('rejects invalid baseline encoding', () => {
    const f = fixture();
    const baseline = Buffer.concat([Buffer.from(f.before), Buffer.from([0xff])]);
    writeFileSync(nodePath.join(f.root, 'bun.lock'), baseline);
    f.git('add', 'bun.lock');
    f.commit('invalid baseline fixture');
    f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    f.write(f.before.replace('1.1.0', '1.2.0'));
    expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(
      expect.objectContaining({ code: 'REVIEW_TARGET_INVALID_TEXT' }),
    );
  });

  it.skipIf(process.platform === 'win32')(
    'rejects a successful Git capture that returns only the first 16 KiB of the baseline',
    () => {
      const f = fixture();
      f.write(f.before.replace('1.1.0', '1.2.0'));
      const located = spawnSync('which', ['git'], { encoding: 'utf8' });
      expect(located.status).toBe(0);
      const realGit = realpathSync(located.stdout.trim());
      const host = temporaryDirectory();
      const marker = nodePath.join(host, 'truncated');
      // This fault targets file-backed cat-file capture; a pipe migration must update the injector.
      writeFileSync(
        nodePath.join(host, 'git'),
        `#!/usr/bin/env node
const {spawnSync} = require('node:child_process');
const {ftruncateSync,writeFileSync} = require('node:fs');
const args = process.argv.slice(2);
const result = spawnSync(${JSON.stringify(realGit)}, args, {stdio:'inherit'});
if (args[0] === 'cat-file' && args[1] === 'blob' && result.status === 0) {
  ftruncateSync(1, 16384);
  writeFileSync(${JSON.stringify(marker)}, 'successful truncated baseline');
}
process.exit(result.status ?? 1);
`,
        { mode: 0o755 },
      );
      vi.stubEnv('PATH', `${host}${nodePath.delimiter}${process.env.PATH ?? ''}`);
      expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(
        /Git returned an incomplete lockfile baseline/u,
      );
      expect(readFileSync(marker, 'utf8')).toBe('successful truncated baseline');
    },
  );

  it.skipIf(process.platform === 'win32')(
    'rejects a valid first hunk when later dependency hunks are lost',
    () => {
      const f = fixture();
      const lock = JSON.parse(f.before.replace('1.1.0', '1.2.0'));
      lock.packages['dependency-5999'].version = '9.0.0';
      f.write(`${JSON.stringify(lock, undefined, 2)}\n`);
      const located = spawnSync('which', ['git'], { encoding: 'utf8' });
      expect(located.status).toBe(0);
      const realGit = realpathSync(located.stdout.trim());
      const host = temporaryDirectory();
      const marker = nodePath.join(host, 'truncated');
      writeFileSync(
        nodePath.join(host, 'git'),
        String.raw`#!/usr/bin/env node
const {spawnSync} = require('node:child_process');
const {readFileSync,writeFileSync} = require('node:fs');
const args = process.argv.slice(2);
const result = spawnSync(${JSON.stringify(realGit)}, args, {stdio:'inherit'});
const output = args.find(arg => arg.startsWith('--output='));
if (args.includes('diff') && output && result.status === 1) {
  const path = output.slice('--output='.length);
  const patch = readFileSync(path,'utf8');
  const first = patch.indexOf('\n@@ ');
  const second = patch.indexOf('\n@@ ', first + 1);
  if (second < 0) process.exit(91);
  writeFileSync(path, patch.slice(0, second + 1));
  writeFileSync(${JSON.stringify(marker)}, 'truncated after a complete hunk');
}
process.exit(result.status ?? 1);
`,
        { mode: 0o755 },
      );
      vi.stubEnv('PATH', `${host}${nodePath.delimiter}${process.env.PATH ?? ''}`);
      expect(() => prepareReviewPacket(f.root, 'quality-review', ['bun.lock'])).toThrow(
        /does not reconstruct/u,
      );
      expect(readFileSync(marker, 'utf8')).toBe('truncated after a complete hunk');
    },
  );
});
