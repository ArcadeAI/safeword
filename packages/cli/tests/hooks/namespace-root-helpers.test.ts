/**
 * Hook-side namespace-root lib behavior (ticket TAGWZ8). The differential
 * test pins resolveNamespaceRoot against the CLI copy; this file covers the
 * hook-only helpers isNamespacePath and readConfiguredPathValue. Project
 * selection lives in project-directory.test.ts.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  isNamespacePath,
  readConfiguredPathValue,
} from '../../templates/hooks/lib/namespace-root.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

describe('isNamespacePath (TAGWZ8)', () => {
  it('matches the default root, absolute and relative', () => {
    expect(isNamespacePath('/repo/.project/tickets/T/ticket.md', 'tickets/')).toBe(true);
    expect(isNamespacePath('.project/tickets/T/ticket.md', 'tickets/')).toBe(true);
  });

  it('matches the legacy root', () => {
    expect(isNamespacePath('.safeword-project/tickets/T/ticket.md', 'tickets/')).toBe(true);
    expect(isNamespacePath('/repo/.safeword-project/learnings/foo.md', 'learnings/')).toBe(true);
  });

  it('rejects roots that merely end with the namespace name', () => {
    // foo.project/ is NOT the namespace root — boundary must be a path
    // separator or string start.
    expect(isNamespacePath('foo.project/tickets/T/ticket.md', 'tickets/')).toBe(false);
    expect(isNamespacePath('/repo/my.safeword-project/tickets/T/ticket.md', 'tickets/')).toBe(
      false,
    );
  });

  it('rejects paths outside the requested subpath', () => {
    expect(isNamespacePath('.project/learnings/foo.md', 'tickets/')).toBe(false);
  });
});

describe('readConfiguredPathValue (#5373)', () => {
  let root: string;

  beforeEach(() => {
    root = createTemporaryDirectory();
    mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  });

  afterEach(() => {
    removeTemporaryDirectory(root);
  });

  const writeConfig = (content: string) => {
    writeFileSync(nodePath.join(root, '.safeword', 'config.json'), content);
  };

  it('returns the configured path', () => {
    writeConfig(JSON.stringify({ paths: { projectRoot: 'docs/project' } }));
    expect(readConfiguredPathValue(root, 'projectRoot')).toBe('docs/project');
  });

  it.each(['null', '42', '"text"', '[]', '{"paths":null}', '{"paths":"x"}', '{not json'])(
    'falls back to defaults for config.json containing %s',
    content => {
      writeConfig(content);
      expect(readConfiguredPathValue(root, 'projectRoot')).toBeUndefined();
    },
  );
});
