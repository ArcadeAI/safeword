/**
 * Unit tests for narrative resolution (ticket BY7RNR, GitHub #848). Resolution
 * rule (spec Vocabulary): a non-empty
 * `paths.architecture` wins outright — even when its target is missing on
 * disk — else the root `ARCHITECTURE.md`. Temp-dir fixtures.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveArchitectureNarrative } from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context: { directory: string } = { directory: '' };

beforeEach(() => {
  context.directory = createTemporaryDirectory();
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

function writeConfig(paths: Record<string, string>): void {
  mkdirSync(nodePath.join(context.directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(context.directory, '.safeword', 'config.json'),
    JSON.stringify({ paths }),
  );
}

describe('resolveArchitectureNarrative', () => {
  it('resolves a configured relative path against the project root and keeps it as the display path', () => {
    writeConfig({ architecture: 'docs/agents/architecture.md' });

    const narrative = resolveArchitectureNarrative(context.directory);

    expect(narrative.absolutePath).toBe(
      nodePath.join(context.directory, 'docs/agents/architecture.md'),
    );
    expect(narrative.displayPath).toBe('docs/agents/architecture.md');
  });

  it('uses a configured absolute path verbatim', () => {
    const absolute = nodePath.join(context.directory, 'elsewhere', 'arch.md');
    writeConfig({ architecture: absolute });

    expect(resolveArchitectureNarrative(context.directory).absolutePath).toBe(absolute);
  });

  it('falls back to root ARCHITECTURE.md when unconfigured', () => {
    const narrative = resolveArchitectureNarrative(context.directory);

    expect(narrative.absolutePath).toBe(nodePath.join(context.directory, 'ARCHITECTURE.md'));
    expect(narrative.displayPath).toBe('ARCHITECTURE.md');
  });

  it('treats an empty-string value as unconfigured', () => {
    writeConfig({ architecture: '' });

    expect(resolveArchitectureNarrative(context.directory).absolutePath).toBe(
      nodePath.join(context.directory, 'ARCHITECTURE.md'),
    );
  });
});
