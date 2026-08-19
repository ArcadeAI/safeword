/**
 * `safeword project review-knowledge` (ticket GJB22B) — the public subcommand
 * replacing `.safeword/hooks/resolve-project-knowledge.ts` for hosts with no
 * installed hooks directory. Resolves the three review sources with their
 * current content, so a reviewer reads what is on disk now rather than labels
 * remembered from intake.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { observeReviewKnowledge } from '../../src/commands/review-knowledge.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

interface KnowledgeSource {
  readonly key: string;
  readonly configured: boolean;
  readonly path: string;
  readonly exists: boolean;
  readonly content: string | undefined;
}

function sourcesOf(data: unknown): KnowledgeSource[] {
  return (data as { sources: KnowledgeSource[] }).sources;
}

describe('project review-knowledge', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  it('reports every review source as absent when none exist', async () => {
    const result = await observeReviewKnowledge(temporaryDirectory);

    expect(sourcesOf(result.data).map(source => source.key)).toEqual([
      'principles',
      'personas',
      'surfaces',
    ]);
    expect(sourcesOf(result.data).every(source => !source.exists)).toBe(true);
    expect(sourcesOf(result.data).every(source => source.content === undefined)).toBe(true);
  });

  it('reads current content from the default namespace location', async () => {
    mkdirSync(nodePath.join(temporaryDirectory, '.project'), { recursive: true });
    writeFileSync(
      nodePath.join(temporaryDirectory, '.project', 'principles.md'),
      '# Principles\n\nShip small.\n',
    );

    const result = await observeReviewKnowledge(temporaryDirectory);
    const principles = sourcesOf(result.data).find(source => source.key === 'principles');

    expect(principles).toMatchObject({
      configured: false,
      exists: true,
      path: nodePath.join('.project', 'principles.md'),
      content: '# Principles\n\nShip small.\n',
    });
  });

  it('follows a paths override and marks the source as configured', async () => {
    mkdirSync(nodePath.join(temporaryDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(temporaryDirectory, '.safeword', 'config.json'),
      JSON.stringify({ paths: { personas: 'docs/who.md' } }),
    );
    mkdirSync(nodePath.join(temporaryDirectory, 'docs'), { recursive: true });
    writeFileSync(nodePath.join(temporaryDirectory, 'docs', 'who.md'), 'Ana the auditor.\n');

    const result = await observeReviewKnowledge(temporaryDirectory);
    const personas = sourcesOf(result.data).find(source => source.key === 'personas');

    expect(personas).toMatchObject({
      configured: true,
      exists: true,
      path: nodePath.join('docs', 'who.md'),
      content: 'Ana the auditor.\n',
    });
  });
});
