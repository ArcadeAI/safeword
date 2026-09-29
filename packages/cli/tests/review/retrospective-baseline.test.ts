import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateBaselineBlobClaims } from '../../src/review/retrospective-baseline.js';

function fixture() {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-baseline-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('config', 'commit.gpgsign', 'false');
  mkdirSync(nodePath.join(root, 'src'));
  writeFileSync(nodePath.join(root, 'src', 'behavior.ts'), 'export const behavior = true;\n');
  git('add', '.');
  git('commit', '-qm', 'baseline');
  const baseline = git('rev-parse', 'HEAD');
  const blobSha = git('rev-parse', `${baseline}:src/behavior.ts`);
  const claim = { baselinePath: 'src/behavior.ts', currentPath: 'src/behavior.ts', blobSha };
  return {
    root,
    git,
    baseline,
    claim,
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

describe('retrospective baseline blobs', () => {
  it('accepts an exact committed implementation blob mapped to a regular current file', () => {
    const history = fixture();
    try {
      expect(validateBaselineBlobClaims(history.root, history.baseline, [history.claim])).toEqual({
        valid: true,
      });
      writeFileSync(
        nodePath.join(history.root, 'src', 'moved.ts'),
        'new implementation location\n',
      );
      expect(
        validateBaselineBlobClaims(history.root, history.baseline, [
          { ...history.claim, currentPath: 'src/moved.ts' },
        ]),
      ).toEqual({ valid: true });
    } finally {
      history.cleanup();
    }
  });

  it('rejects a changed blob digest and a missing baseline path', () => {
    const history = fixture();
    try {
      expect(
        validateBaselineBlobClaims(history.root, history.baseline, [
          { ...history.claim, blobSha: '0'.repeat(40) },
        ]),
      ).toEqual({
        valid: false,
        reason: 'Baseline blob src/behavior.ts does not match its claimed digest.',
      });
      expect(
        validateBaselineBlobClaims(history.root, history.baseline, [
          { ...history.claim, baselinePath: 'src/missing.ts' },
        ]),
      ).toEqual({
        valid: false,
        reason: 'Baseline blob src/missing.ts does not match its claimed digest.',
      });
    } finally {
      history.cleanup();
    }
  });

  it('rejects path traversal and a missing current mapping', () => {
    const history = fixture();
    try {
      expect(
        validateBaselineBlobClaims(history.root, history.baseline, [
          { ...history.claim, baselinePath: '../behavior.ts' },
        ]),
      ).toEqual({
        valid: false,
        reason: 'An implementation path is not a safe project-relative path.',
      });
      expect(
        validateBaselineBlobClaims(history.root, history.baseline, [
          { ...history.claim, currentPath: 'src/missing.ts' },
        ]),
      ).toEqual({
        valid: false,
        reason: 'Current implementation file src/missing.ts is unavailable.',
      });
    } finally {
      history.cleanup();
    }
  });

  it('requires a commit, nonempty claims, and unique path mappings', () => {
    const history = fixture();
    try {
      expect(validateBaselineBlobClaims(history.root, 'HEAD', [history.claim])).toEqual({
        valid: false,
        reason: 'The baseline must be a full lowercase commit SHA.',
      });
      expect(validateBaselineBlobClaims(history.root, history.baseline, [])).toEqual({
        valid: false,
        reason: 'No baseline implementation blobs were named.',
      });
      expect(
        validateBaselineBlobClaims(history.root, history.baseline, [history.claim, history.claim]),
      ).toEqual({
        valid: false,
        reason: 'Implementation paths must have a one-to-one baseline-to-current mapping.',
      });
    } finally {
      history.cleanup();
    }
  });

  it.runIf(process.platform !== 'win32')(
    'rejects a current symlink and a symlink blob at baseline',
    () => {
      const history = fixture();
      try {
        symlinkSync('behavior.ts', nodePath.join(history.root, 'src', 'alias.ts'));
        expect(
          validateBaselineBlobClaims(history.root, history.baseline, [
            { ...history.claim, currentPath: 'src/alias.ts' },
          ]),
        ).toEqual({
          valid: false,
          reason: 'Current implementation file src/alias.ts is unavailable.',
        });
        history.git('add', 'src/alias.ts');
        history.git('commit', '-qm', 'add symlink');
        const newBaseline = history.git('rev-parse', 'HEAD');
        const symlinkBlob = history.git('rev-parse', `${newBaseline}:src/alias.ts`);
        expect(
          validateBaselineBlobClaims(history.root, newBaseline, [
            {
              baselinePath: 'src/alias.ts',
              currentPath: 'src/behavior.ts',
              blobSha: symlinkBlob,
            },
          ]),
        ).toEqual({
          valid: false,
          reason: 'Baseline blob src/alias.ts does not match its claimed digest.',
        });
      } finally {
        history.cleanup();
      }
    },
  );

  it.runIf(process.platform !== 'win32')(
    'rejects a non-portable path even when Git contains that exact file',
    () => {
      const history = fixture();
      try {
        const unusualPath = String.raw`src/odd\name.ts`;
        writeFileSync(nodePath.join(history.root, unusualPath), 'export const odd = true;\n');
        history.git('add', '--all');
        history.git('commit', '-qm', 'add unusual path');
        const baseline = history.git('rev-parse', 'HEAD');
        const blobSha = history.git('rev-parse', `${baseline}:${unusualPath}`);
        expect(
          validateBaselineBlobClaims(history.root, baseline, [
            { baselinePath: unusualPath, currentPath: unusualPath, blobSha },
          ]),
        ).toEqual({
          valid: false,
          reason: 'An implementation path is not a safe project-relative path.',
        });
      } finally {
        history.cleanup();
      }
    },
  );
});
