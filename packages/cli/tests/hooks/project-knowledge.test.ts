import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  resolveReviewKnowledgeSources,
  type ReviewKnowledgeSource,
} from '../../templates/hooks/lib/project-knowledge.js';
describe('resolveReviewKnowledgeSources', () => {
  const temporaryDirectories: string[] = [];

  function project(): string {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-project-knowledge-'));
    temporaryDirectories.push(directory);
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(directory, '.project'), { recursive: true });
    return directory;
  }

  afterEach(() => {
    for (const directory of temporaryDirectories) {
      rmSync(directory, { recursive: true, force: true });
    }
    temporaryDirectories.length = 0;
  });

  it('resolves the three default sources with their current content', () => {
    const directory = project();
    for (const [key, content] of [
      ['principles', '# Principles\n'],
      ['personas', '# Personas\n'],
      ['surfaces', '# Surfaces\n'],
    ] as const) {
      writeFileSync(nodePath.join(directory, '.project', `${key}.md`), content);
    }

    expect(resolveReviewKnowledgeSources(directory)).toEqual([
      source('principles', directory, '.project/principles.md', '# Principles\n'),
      source('personas', directory, '.project/personas.md', '# Personas\n'),
      source('surfaces', directory, '.project/surfaces.md', '# Surfaces\n'),
    ]);
  });

  it('honors overrides and rereads changed source content for a later review', () => {
    const directory = project();
    mkdirSync(nodePath.join(directory, 'docs'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ paths: { principles: 'docs/values.md' } }),
    );
    writeFileSync(nodePath.join(directory, 'docs', 'values.md'), 'first\n');

    expect(resolveReviewKnowledgeSources(directory)[0]?.content).toBe('first\n');
    writeFileSync(nodePath.join(directory, 'docs', 'values.md'), 'second\n');
    expect(resolveReviewKnowledgeSources(directory)[0]).toEqual(
      source('principles', directory, 'docs/values.md', 'second\n'),
    );
  });

  it('exposes the current sources as JSON through the installed review wrapper', () => {
    const directory = project();
    writeFileSync(nodePath.join(directory, '.project', 'principles.md'), '# Current values\n');
    const wrapper = nodePath.join(__dirname, '../../templates/hooks/resolve-project-knowledge.ts');

    const result = spawnSync('bun', [wrapper, directory], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'principles', content: '# Current values\n' }),
      ]),
    );
  });
});

function source(
  key: ReviewKnowledgeSource['key'],
  projectDirectory: string,
  relativePath: string,
  content: string,
): ReviewKnowledgeSource {
  return {
    key,
    configured: !relativePath.startsWith('.project/'),
    path: nodePath.join(projectDirectory, relativePath),
    exists: true,
    content,
  };
}
