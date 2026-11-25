import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  nativeResourceRevision,
  validatedResourceRevision,
} from '../../src/codex-plugin/resource-revision.js';

const roots: string[] = [];
const files = {
  'skills/public/SKILL.md': 'public procedure',
  'internal/private/SKILL.md': 'internal procedure',
  'internal/private/references/nested.md': 'nested resource',
  'templates/guides/guide.md': 'guide',
  'resources/SAFEWORD.md': 'handbook',
};
function packageRoot(reverse = false): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-resource-revision-'));
  roots.push(root);
  const entries = reverse ? Object.entries(files).toReversed() : Object.entries(files);
  for (const [relative, content] of entries) {
    const file = nodePath.join(root, relative);
    mkdirSync(nodePath.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('native complete-resource identity, not a native read receipt', () => {
  it('is stable across package roots, ancestor aliases and creation order', () => {
    const first = packageRoot();
    const second = packageRoot(true);
    expect(nativeResourceRevision(second)).toBe(nativeResourceRevision(first));
    const alias = `${first}-alias`;
    roots.push(alias);
    symlinkSync(first, alias, 'dir');
    expect(nativeResourceRevision(alias)).toBe(nativeResourceRevision(first));
  });
  it.each(Object.keys(files))('changes when only %s changes', relative => {
    const root = packageRoot();
    const previous = nativeResourceRevision(root);
    writeFileSync(nodePath.join(root, relative), 'new canonical content');
    expect(nativeResourceRevision(root)).not.toBe(previous);
  });
  it('covers additions and removals, but excludes index self-content and compiler runtime', () => {
    const root = packageRoot();
    const previous = nativeResourceRevision(root);
    writeFileSync(nodePath.join(root, 'resources/workflow-index.json'), 'any revision');
    mkdirSync(nodePath.join(root, 'runtime'));
    writeFileSync(nodePath.join(root, 'runtime/cli.js'), 'different compiler output');
    expect(nativeResourceRevision(root)).toBe(previous);
    const extra = nodePath.join(root, 'templates/extra.md');
    writeFileSync(extra, 'extra resource');
    expect(nativeResourceRevision(root)).not.toBe(previous);
    expect(() =>
      validatedResourceRevision(root, { resourceRevision: { version: 1, sha256: previous } }),
    ).toThrow(/Stale/u);
    rmSync(extra);
    rmSync(nodePath.join(root, 'templates/guides/guide.md'));
    expect(() =>
      validatedResourceRevision(root, { resourceRevision: { version: 1, sha256: previous } }),
    ).toThrow(/Stale/u);
  });
  it.each(['internal', 'internal/private/references/nested.md', 'resources/SAFEWORD.md'])(
    'rejects symlinked carrier root or nested file %s',
    relative => {
      const root = packageRoot();
      const outside = packageRoot();
      const file = nodePath.join(root, relative);
      rmSync(file, { recursive: true });
      symlinkSync(nodePath.join(outside, relative), file);
      expect(() => nativeResourceRevision(root)).toThrow(/symlink/u);
    },
  );
  it.each(['skills', 'internal', 'templates', 'resources/SAFEWORD.md'])(
    'rejects deletion of previously indexed content in carrier %s',
    relative => {
      const root = packageRoot();
      const sha256 = nativeResourceRevision(root);
      rmSync(nodePath.join(root, relative), { recursive: true });
      const failure =
        relative === 'skills' || relative === 'internal' ? /Stale resource revision/u : /ENOENT/u;
      expect(() =>
        validatedResourceRevision(root, { resourceRevision: { version: 1, sha256 } }),
      ).toThrow(failure);
    },
  );
  it.each(['skills', 'internal'])(
    'gives empty and absent optional %s roots the same regular-file identity',
    relative => {
      const root = packageRoot();
      const carrier = nodePath.join(root, relative);
      rmSync(carrier, { recursive: true });
      mkdirSync(carrier);
      const sha256 = nativeResourceRevision(root);
      rmSync(carrier, { recursive: true });
      expect(nativeResourceRevision(root)).toBe(sha256);
      expect(validatedResourceRevision(root, { resourceRevision: { version: 1, sha256 } })).toBe(
        sha256,
      );
    },
  );
  it.each(['skills', 'internal', 'internal/private/references/nested.md'])(
    'rejects dangling symlinks at optional roots and nested resources: %s',
    relative => {
      const root = packageRoot();
      const file = nodePath.join(root, relative);
      rmSync(file, { recursive: true });
      symlinkSync(nodePath.join(root, 'absent-target'), file);
      expect(() => nativeResourceRevision(root)).toThrow(/symlink/u);
    },
  );
});
