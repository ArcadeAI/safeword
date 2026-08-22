import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  nodeRemoteWorkflowFs,
  publishExclusiveFile,
  type RemoteWorkflowFs,
} from '../../src/test-execution/remote-workflow-fs';

const roots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-remote-workflow-'));
  roots.push(root);
  return root;
}

function withFilesystem(overrides: Partial<RemoteWorkflowFs>): RemoteWorkflowFs {
  return { ...nodeRemoteWorkflowFs, ...overrides };
}

function failure(code: string): Error {
  return Object.assign(new Error(code), { code });
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('exclusive workflow publication', () => {
  it('publishes complete bytes and removes its private entry', () => {
    const root = temporaryRoot();
    const destination = nodePath.join(root, 'safeword-tests.yml');

    const result = publishExclusiveFile(destination, 'name: safeword\n');

    expect(result).toMatchObject({ published: true });
    expect(readFileSync(destination, 'utf8')).toBe('name: safeword\n');
    expect(existsSync(result.privatePath)).toBe(false);
  });

  it('publishes complete bytes without replacing a concurrently appearing destination', () => {
    const root = temporaryRoot();
    const destination = nodePath.join(root, 'safeword-tests.yml');
    const customerBytes = 'name: customer\n';

    const result = publishExclusiveFile(
      destination,
      'name: safeword\n',
      withFilesystem({
        link: (privatePath, publishedPath) => {
          writeFileSync(destination, customerBytes, { flag: 'wx' });
          nodeRemoteWorkflowFs.link(privatePath, publishedPath);
        },
      }),
    );

    expect(result).toMatchObject({ published: false, code: 'EEXIST' });
    expect(readFileSync(destination, 'utf8')).toBe(customerBytes);
    expect(result.privatePath.endsWith('.yml')).toBe(false);
    expect(result.privatePath.endsWith('.yaml')).toBe(false);
    expect(existsSync(result.privatePath)).toBe(false);
  });

  it.each([
    ['create', 'openPrivate', 'EACCES'],
    ['write', 'write', 'ENOSPC'],
    ['sync', 'sync', 'EIO'],
    ['link', 'link', 'EXDEV'],
  ] as const)('types a failed %s operation', (operation, method, code) => {
    const root = temporaryRoot();
    const destination = nodePath.join(root, 'safeword-tests.yml');
    const filesystem = withFilesystem({
      [method]: () => {
        throw failure(code);
      },
    });

    const result = publishExclusiveFile(destination, 'name: safeword\n', filesystem);
    expect(result).toMatchObject({
      published: false,
      operation,
      code,
    });
    expect(existsSync(destination)).toBe(false);
    expect(existsSync(result.privatePath)).toBe(false);
  });

  it('types close failure honestly and cleans up', () => {
    const root = temporaryRoot();
    const destination = nodePath.join(root, 'safeword-tests.yml');

    expect(
      publishExclusiveFile(
        destination,
        'name: safeword\n',
        withFilesystem({
          close: () => {
            throw failure('EIO');
          },
        }),
      ),
    ).toMatchObject({ published: false, operation: 'close', code: 'EIO' });
    expect(existsSync(destination)).toBe(false);
  });

  it('reports a zero-progress write without inventing an OS error', () => {
    const root = temporaryRoot();
    const destination = nodePath.join(root, 'safeword-tests.yml');

    const result = publishExclusiveFile(
      destination,
      'name: safeword\n',
      withFilesystem({ write: () => 0 }),
    );

    expect(result).toMatchObject({
      published: false,
      operation: 'write',
      code: 'ESHORTWRITE',
    });
    expect(existsSync(destination)).toBe(false);
    expect(existsSync(result.privatePath)).toBe(false);
  });

  it('does not remove a private path owned by a concurrent invocation', () => {
    const root = temporaryRoot();
    const destination = nodePath.join(root, 'safeword-tests.yml');
    const privatePath = nodePath.join(root, '.safeword-concurrent');
    writeFileSync(privatePath, 'concurrent');

    expect(
      publishExclusiveFile(
        destination,
        'name: safeword\n',
        withFilesystem({ privatePath: () => privatePath }),
      ),
    ).toMatchObject({ published: false, operation: 'create', code: 'EEXIST' });
    expect(readFileSync(privatePath, 'utf8')).toBe('concurrent');
  });
});
