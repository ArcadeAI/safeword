/**
 * Differential test (P58R22 pattern) pinning the hook-side `parseGeneratedFingerprint`
 * against the canonical CLI `readDocumentFingerprint` that WRITES the generated doc
 * (ticket AXRC4D, GitHub #559). The hook lib deliberately re-implements the parser
 * (hooks run standalone under bun in customer repos, with no import path to the CLI), so
 * the two could silently diverge if the doc's frontmatter format ever changes. This test
 * makes that divergence loud: for every fixture, both readers must agree.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readDocumentFingerprint } from '../../src/utils/architecture-document.js';
import { resolveArchitectureNarrative as cliResolveArchitectureNarrative } from '../../src/utils/configured-paths.js';
import {
  parseGeneratedFingerprint,
  resolveArchitectureNarrative as hookResolveArchitectureNarrative,
} from '../../templates/hooks/lib/architecture-document-nudge.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const FIXTURES: Record<string, string> = {
  'canonical doc':
    '---\ngenerator: safeword-architecture\nfingerprint: abc123\n---\n\n# Architecture\n',
  'fingerprint as the only key': '---\nfingerprint: deadbeef\n---\n',
  'fingerprint not the first key':
    '---\ngenerator: safeword-architecture\nfingerprint: zzz999\n---\n',
  'CRLF line endings': '---\r\ngenerator: safeword-architecture\r\nfingerprint: c0ffee\r\n---\r\n',
  'empty fingerprint value': '---\nfingerprint:\n---\n',
  'no frontmatter at all': '# Architecture\n\nThe human narrative, no fences.\n',
  'a fingerprint-looking line OUTSIDE the frontmatter':
    '---\ngenerator: safeword-architecture\n---\n\nfingerprint: not-this-one\n',
  'empty content': '',
  'unterminated frontmatter': '---\nfingerprint: abc\n',
};

describe('parseGeneratedFingerprint ⇄ readDocumentFingerprint differential', () => {
  for (const [name, content] of Object.entries(FIXTURES)) {
    it(`agrees on: ${name}`, () => {
      expect(parseGeneratedFingerprint(content)).toBe(readDocumentFingerprint(content));
    });
  }
});

/**
 * Same P58R22 pin for the narrative resolver (ticket BY7RNR, GitHub #848): the
 * hook lib re-implements `resolveArchitectureNarrative` standalone, so both
 * copies must agree on every config shape — including the defensive ones
 * (unparseable JSON, empty string, non-string value).
 */
const CONFIG_FIXTURES: Record<string, string | undefined> = {
  'no config file at all': undefined,
  'a configured relative path': JSON.stringify({ paths: { architecture: 'docs/arch.md' } }),
  'a configured directory': JSON.stringify({ paths: { architecture: 'docs/adr' } }),
  'an empty-string value': JSON.stringify({ paths: { architecture: '' } }),
  'a non-string value': JSON.stringify({ paths: { architecture: 7 } }),
  'no paths object': JSON.stringify({ installedPacks: [] }),
  'unparseable JSON': '{ not json',
};

describe('resolveArchitectureNarrative hook ⇄ CLI differential', () => {
  const context: { directory: string } = { directory: '' };

  beforeEach(() => {
    context.directory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(context.directory);
  });

  for (const [name, config] of Object.entries(CONFIG_FIXTURES)) {
    it(`agrees on: ${name}`, () => {
      if (config !== undefined) {
        mkdirSync(nodePath.join(context.directory, '.safeword'), { recursive: true });
        writeFileSync(nodePath.join(context.directory, '.safeword', 'config.json'), config);
      }

      expect(hookResolveArchitectureNarrative(context.directory)).toEqual(
        cliResolveArchitectureNarrative(context.directory),
      );
    });
  }

  it('agrees on: a configured absolute path', () => {
    const absolute = nodePath.join(context.directory, 'elsewhere', 'arch.md');
    mkdirSync(nodePath.join(context.directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, '.safeword', 'config.json'),
      JSON.stringify({ paths: { architecture: absolute } }),
    );

    expect(hookResolveArchitectureNarrative(context.directory)).toEqual(
      cliResolveArchitectureNarrative(context.directory),
    );
  });
});
