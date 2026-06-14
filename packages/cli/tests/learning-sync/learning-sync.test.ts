import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildIndexContent,
  INDEX_FILENAME,
  LEARNINGS_RELATIVE_PATH,
  parseLearning,
  readLearnings,
  syncLearnings,
} from '../../src/learning-sync/index.js';

describe('learning-sync', () => {
  let temporaryDirectory: string;
  let learningsDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-learning-sync-'));
    learningsDirectory = nodePath.join(temporaryDirectory, '.project', 'learnings');
    mkdirSync(learningsDirectory, { recursive: true });
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  function writeLearning(fileName: string, body: string) {
    writeFileSync(nodePath.join(learningsDirectory, fileName), body);
  }

  describe('parseLearning()', () => {
    it('extracts title and covers when well-formed', () => {
      const file = nodePath.join(learningsDirectory, 'a.md');
      writeFileSync(file, '# A Title\n\nCovers: topic one, topic two.\n\nBody.\n');
      const result = parseLearning(file);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.entry.title).toBe('A Title');
        expect(result.entry.covers).toBe('topic one, topic two.');
      }
    });

    it('falls back to filename when H1 is missing', () => {
      const file = nodePath.join(learningsDirectory, 'foo.md');
      writeFileSync(file, 'not an h1\n\nCovers: x.\n');
      const result = parseLearning(file);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.entry.title).toBe('foo');
    });

    it('rejects files without Covers: on line 3', () => {
      const file = nodePath.join(learningsDirectory, 'b.md');
      writeFileSync(file, '# B\n\n**Finding:** something.\n');
      const result = parseLearning(file);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain('Covers');
    });

    it('rejects empty Covers: lines', () => {
      const file = nodePath.join(learningsDirectory, 'c.md');
      writeFileSync(file, '# C\n\nCovers:\n\nBody.\n');
      const result = parseLearning(file);
      expect(result.ok).toBe(false);
    });

    it('rejects files with fewer than 3 lines', () => {
      const file = nodePath.join(learningsDirectory, 'short.md');
      writeFileSync(file, '# Short\n');
      const result = parseLearning(file);
      expect(result.ok).toBe(false);
    });
  });

  describe('readLearnings()', () => {
    it('returns entries sorted by filename and separates skipped files', () => {
      writeLearning('z.md', '# Zed\n\nCovers: z-topic.\n');
      writeLearning('a.md', '# Alpha\n\nCovers: a-topic.\n');
      writeLearning('bad.md', '# Bad\n\nNot a covers line.\n');

      const { entries, skipped } = readLearnings(learningsDirectory);
      expect(entries.map(entry => entry.fileName)).toEqual(['a.md', 'z.md']);
      expect(skipped).toHaveLength(1);
      expect(skipped[0]?.fileName).toBe('bad.md');
    });

    it('ignores non-markdown files', () => {
      writeLearning('note.md', '# N\n\nCovers: x.\n');
      writeFileSync(nodePath.join(learningsDirectory, 'readme.txt'), 'ignore me');
      const { entries, skipped } = readLearnings(learningsDirectory);
      expect(entries).toHaveLength(1);
      expect(skipped).toHaveLength(0);
    });

    it('excludes INDEX.md from enumeration so it does not try to parse itself', () => {
      writeLearning('real.md', '# Real\n\nCovers: real.\n');
      writeLearning('INDEX.md', '# Project Learnings — Index\n\nsome body\n');
      const { entries, skipped } = readLearnings(learningsDirectory);
      expect(entries.map(entry => entry.fileName)).toEqual(['real.md']);
      expect(skipped).toHaveLength(0);
    });

    it('handles missing learnings directory', () => {
      const { entries, skipped } = readLearnings(
        nodePath.join(temporaryDirectory, 'does-not-exist'),
      );
      expect(entries).toEqual([]);
      expect(skipped).toEqual([]);
    });
  });

  describe('buildIndexContent()', () => {
    it('renders an index with title, count, and one entry per file', () => {
      const content = buildIndexContent([
        {
          fileName: 'x.md',
          relativePath: `${LEARNINGS_RELATIVE_PATH}/x.md`,
          title: 'X',
          covers: 'x-topic.',
        },
        {
          fileName: 'y.md',
          relativePath: `${LEARNINGS_RELATIVE_PATH}/y.md`,
          title: 'Y',
          covers: 'y-topic.',
        },
      ]);
      expect(content).toMatch(/^# Project Learnings — Index/);
      expect(content).toContain('## Learnings (2)');
      expect(content).toContain('- **X** — x-topic.');
      expect(content).toContain(`→ \`${LEARNINGS_RELATIVE_PATH}/x.md\``);
      expect(content).toContain('- **Y** — y-topic.');
    });

    it('renders an empty-state body when there are no entries', () => {
      const content = buildIndexContent([]);
      expect(content).toContain('No learnings recorded yet');
      expect(content).not.toContain('## Learnings');
    });

    it('is deterministic for the same input', () => {
      const entries = [
        {
          fileName: 'a.md',
          relativePath: 'p/a.md',
          title: 'A',
          covers: 'one.',
        },
        {
          fileName: 'b.md',
          relativePath: 'p/b.md',
          title: 'B',
          covers: 'two.',
        },
      ];
      expect(buildIndexContent(entries)).toBe(buildIndexContent(entries));
    });

    it('scales to hundreds of entries without a size cap', () => {
      const entries = Array.from({ length: 500 }, (_, i) => ({
        fileName: `f${i}.md`,
        relativePath: `path/f${i}.md`,
        title: `Title ${i}`,
        covers: `topic ${i} with keywords`,
      }));
      const content = buildIndexContent(entries);
      // All 500 entries present — no truncation.
      expect(content).toContain('**Title 0**');
      expect(content).toContain('**Title 499**');
      expect(content).toContain('## Learnings (500)');
    });
  });

  describe('syncLearnings()', () => {
    it('writes INDEX.md on first run', () => {
      writeLearning('foo.md', '# Foo\n\nCovers: foo topic.\n');
      const result = syncLearnings(temporaryDirectory);
      expect(result.wrote).toBe(true);
      const expectedPath = nodePath.join(learningsDirectory, INDEX_FILENAME);
      expect(existsSync(expectedPath)).toBe(true);
      expect(readFileSync(expectedPath, 'utf8')).toContain('foo topic');
      expect(result.indexPath).toBe(expectedPath);
    });

    it('is idempotent: second run reports no write', () => {
      writeLearning('foo.md', '# Foo\n\nCovers: foo topic.\n');
      syncLearnings(temporaryDirectory);
      const result = syncLearnings(temporaryDirectory);
      expect(result.wrote).toBe(false);
    });

    it('removes deleted entries on next run', () => {
      writeLearning('a.md', '# A\n\nCovers: a.\n');
      writeLearning('b.md', '# B\n\nCovers: b.\n');
      syncLearnings(temporaryDirectory);

      rmSync(nodePath.join(learningsDirectory, 'b.md'));
      const result = syncLearnings(temporaryDirectory);
      expect(result.wrote).toBe(true);
      const content = readFileSync(result.indexPath, 'utf8');
      expect(content).toContain('**A**');
      expect(content).not.toContain('**B**');
    });

    it('surfaces skipped files in the result', () => {
      writeLearning('good.md', '# Good\n\nCovers: good topic.\n');
      writeLearning('bad.md', '# Bad\n\nNo covers here.\n');
      const result = syncLearnings(temporaryDirectory);
      expect(result.entries).toHaveLength(1);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]?.fileName).toBe('bad.md');
    });

    it('produces a valid empty-state INDEX.md when the folder exists but is empty', () => {
      const result = syncLearnings(temporaryDirectory);
      expect(result.wrote).toBe(true);
      const content = readFileSync(result.indexPath, 'utf8');
      expect(content).toContain('No learnings recorded yet');
    });

    it('is a no-op when the learnings folder does not exist', () => {
      rmSync(learningsDirectory, { recursive: true, force: true });
      const result = syncLearnings(temporaryDirectory);
      expect(result.wrote).toBe(false);
      expect(existsSync(result.indexPath)).toBe(false);
    });
  });
});
