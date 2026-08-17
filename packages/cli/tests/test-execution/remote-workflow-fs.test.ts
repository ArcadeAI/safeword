import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { publishExclusiveFile } from '../../src/test-execution/remote-workflow-fs';

const roots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-remote-workflow-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('exclusive workflow publication', () => {
  it('publishes complete bytes without replacing a concurrently appearing destination', () => {
    const root = temporaryRoot();
    const destination = nodePath.join(root, 'safeword-tests.yml');
    const customerBytes = 'name: customer\n';

    const result = publishExclusiveFile(destination, 'name: safeword\n', {
      beforeLink: () => {
        writeFileSync(destination, customerBytes, { flag: 'wx' });
      },
    });

    expect(result).toMatchObject({ published: false, code: 'EEXIST' });
    expect(readFileSync(destination, 'utf8')).toBe(customerBytes);
    expect(result.privatePath.endsWith('.yml')).toBe(false);
    expect(result.privatePath.endsWith('.yaml')).toBe(false);
  });
});
