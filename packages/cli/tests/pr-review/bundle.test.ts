import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readReviewBundle } from '../../src/pr-review/bundle.js';

describe('the stage-1 review bundle (36EEMY)', () => {
  let bundle: string;

  beforeEach(() => {
    bundle = mkdtempSync(nodePath.join(tmpdir(), 'sw-bundle-'));
  });
  afterEach(() => {
    rmSync(bundle, { recursive: true, force: true });
  });

  function write(relative: string, contents: string): void {
    const full = nodePath.join(bundle, relative);
    mkdirSync(nodePath.dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }

  it('is absent when stage 1 never ran', () => {
    expect(readReviewBundle(nodePath.join(bundle, 'nope'))).toBeUndefined();
  });

  it('reads the diff and the surrounding tree stage 1 collected', () => {
    write('pull-number', '42');
    write('diff.patch', '--- a/src/caller.ts\n+++ b/src/caller.ts\n+helper(x)');
    write('files/src/caller.ts', 'helper(x)');
    write('files/src/helper.ts', 'export function helper(v) { eval(v) }');

    const read = readReviewBundle(bundle);

    expect(read?.pullNumber).toBe(42);
    expect(read?.diff).toContain('+helper(x)');
    // R17's substrate: a file the diff never touched is present, with its path
    // relative to the repo rather than to the bundle.
    const paths = read?.files.map(file => file.path);
    expect(paths).toContain('src/helper.ts');
    expect(read?.files.find(f => f.path === 'src/helper.ts')?.contents).toContain('eval(v)');
  });

  it('treats a bundle with no diff as unusable rather than reviewing nothing', () => {
    // An empty diff would be sent to a paid model and come back with an
    // inevitable "no findings", which then posts as a `reviewed` receipt — a
    // clean bill of health for a review that never saw the change.
    write('pull-number', '42');

    expect(readReviewBundle(bundle)).toBeUndefined();
  });

  it('ignores a bundle whose pull number is not a positive integer', () => {
    write('pull-number', '../../etc/passwd');
    write('diff.patch', 'a diff');

    expect(readReviewBundle(bundle)).toBeUndefined();
  });
});
