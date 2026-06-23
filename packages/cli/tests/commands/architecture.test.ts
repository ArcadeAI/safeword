/**
 * Unit tests for the `safeword architecture` command (ticket QD5DTT, Slice 1).
 * Proves the CLI entry actually invokes selfHeal at the configured location —
 * the wiring the SessionStart hook depends on.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { architecture } from '../../src/commands/architecture.js';
import { resolveGeneratedArchitecturePath } from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context: { directory: string } = { directory: '' };

beforeEach(() => {
  context.directory = createTemporaryDirectory();
  mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });
  writeFileSync(
    nodePath.join(context.directory, 'package.json'),
    JSON.stringify({ name: 'fixture' }),
  );
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

describe('architecture command', () => {
  it('refreshes the architecture document at the configured location', async () => {
    await architecture(context.directory);

    expect(existsSync(resolveGeneratedArchitecturePath(context.directory))).toBe(true);
  });
});
