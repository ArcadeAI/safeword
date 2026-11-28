import { mkdirSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import * as durable from '../../src/codex-plugin/durable-write.js';
import {
  publishConformanceAttempt,
  readConformanceAttempts,
} from '../../src/host-contract/conformance-run.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots) removeTemporaryDirectory(root);
  roots.length = 0;
});
it.each(['before-record', 'after-record'] as const)(
  'recovers interrupted publication %s without an older fallback',
  point => {
    const root = createTemporaryDirectory();
    roots.push(root);
    const store = {
      directory: nodePath.join(root, 'records'),
      keyFile: nodePath.join(root, 'profile/key'),
      headFile: nodePath.join(root, 'profile/heads/bucket.json'),
    };
    mkdirSync(store.directory, { recursive: true });
    publishConformanceAttempt(store, { outcome: 'unavailable' }, 'first');
    const write = durable.writeDurableFileExclusive;
    vi.spyOn(durable, 'writeDurableFileExclusive').mockImplementationOnce((...args) => {
      if (point === 'after-record') write(...args);
      throw new Error('Injected publication interruption');
    });
    expect(() =>
      publishConformanceAttempt(store, { outcome: 'unavailable' }, 'interrupted'),
    ).toThrow('Injected');
    vi.restoreAllMocks();
    expect(readConformanceAttempts(store), 'Pending head must fail closed').toBeUndefined();
    publishConformanceAttempt(store, { outcome: 'unavailable' }, 'fresh');
    expect(readConformanceAttempts(store)?.map(record => record.id)).toEqual([
      'first',
      'interrupted',
      'fresh',
    ]);
  },
);
