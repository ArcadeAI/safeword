import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildDescription,
  buildSkillContent,
  LEARNINGS_RELATIVE_PATH,
  parseLearning,
  readLearnings,
  SKILL_FILENAME,
  SKILL_RELATIVE_DIR,
  syncLearnings,
} from '../../src/learning-sync/index.js';

describe('learning-sync', () => {
  let temporaryDirectory: string;
  let learningsDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-learning-sync-'));
    learningsDirectory = nodePath.join(temporaryDirectory, LEARNINGS_RELATIVE_PATH);
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

    it('handles missing learnings directory', () => {
      const { entries, skipped } = readLearnings(
        nodePath.join(temporaryDirectory, 'does-not-exist'),
      );
      expect(entries).toEqual([]);
      expect(skipped).toEqual([]);
    });
  });

  describe('buildDescription()', () => {
    it('produces a sub-1024-char description for a realistic corpus', () => {
      const entries = Array.from({ length: 16 }, (_, i) => ({
        fileName: `f${i}.md`,
        relativePath: `path/f${i}.md`,
        title: `Title ${i}`,
        covers: `topic ${i}`,
      }));
      const { description, truncated } = buildDescription(entries);
      expect(description.length).toBeLessThanOrEqual(1024);
      expect(description).toContain('Project-specific engineering lessons');
      expect(truncated).toBe(false);
    });

    it('truncates gracefully when topic list overflows the budget', () => {
      const entries = Array.from({ length: 100 }, (_, i) => ({
        fileName: `f${i}.md`,
        relativePath: `path/f${i}.md`,
        title: `Title ${i}`,
        covers: `very long topic description with many keywords number ${i}`,
      }));
      const { description, truncated } = buildDescription(entries);
      expect(description.length).toBeLessThanOrEqual(1024);
      expect(description).toMatch(/…/);
      expect(truncated).toBe(true);
    });

    it('omits the Topics section when there are no entries', () => {
      const { description, truncated } = buildDescription([]);
      expect(description).not.toContain('Topics:');
      expect(truncated).toBe(false);
    });
  });

  describe('buildSkillContent()', () => {
    it('renders frontmatter with user-invocable: false', () => {
      const content = buildSkillContent([
        {
          fileName: 'x.md',
          relativePath: '.safeword-project/learnings/x.md',
          title: 'X',
          covers: 'x-topic.',
        },
      ]);
      expect(content).toMatch(/^---\nname: project-learnings\n/);
      expect(content).toContain('user-invocable: false');
      expect(content).toContain('- **X** — x-topic.');
      expect(content).toContain('→ .safeword-project/learnings/x.md');
    });

    it('renders an empty-state body when there are no entries', () => {
      const content = buildSkillContent([]);
      expect(content).toContain('No learnings recorded yet');
    });

    it('is deterministic for the same input', () => {
      const entries = [
        { fileName: 'a.md', relativePath: 'p/a.md', title: 'A', covers: 'one.' },
        { fileName: 'b.md', relativePath: 'p/b.md', title: 'B', covers: 'two.' },
      ];
      expect(buildSkillContent(entries)).toBe(buildSkillContent(entries));
    });
  });

  describe('syncLearnings()', () => {
    it('writes the skill file on first run', () => {
      writeLearning('foo.md', '# Foo\n\nCovers: foo topic.\n');
      const result = syncLearnings(temporaryDirectory);
      expect(result.wrote).toBe(true);
      const expectedPath = nodePath.join(temporaryDirectory, SKILL_RELATIVE_DIR, SKILL_FILENAME);
      expect(existsSync(expectedPath)).toBe(true);
      expect(readFileSync(expectedPath, 'utf8')).toContain('foo topic');
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
      const skillContent = readFileSync(result.skillPath, 'utf8');
      expect(skillContent).toContain('**A**');
      expect(skillContent).not.toContain('**B**');
    });

    it('surfaces skipped files in the result', () => {
      writeLearning('good.md', '# Good\n\nCovers: good topic.\n');
      writeLearning('bad.md', '# Bad\n\nNo covers here.\n');
      const result = syncLearnings(temporaryDirectory);
      expect(result.entries).toHaveLength(1);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]?.fileName).toBe('bad.md');
    });

    it('produces a valid empty-state skill when no learnings exist', () => {
      const result = syncLearnings(temporaryDirectory);
      expect(result.wrote).toBe(true);
      const content = readFileSync(result.skillPath, 'utf8');
      expect(content).toContain('No learnings recorded yet');
    });

    it('reports descriptionTruncated when topic list overflows', () => {
      for (let i = 0; i < 100; i++) {
        writeLearning(
          `learn-${String(i).padStart(3, '0')}.md`,
          `# Learning ${i}\n\nCovers: topic keyword cluster number ${i} with extra verbose detail.\n\nBody.\n`,
        );
      }
      const result = syncLearnings(temporaryDirectory);
      expect(result.descriptionTruncated).toBe(true);
    });

    it('does not report truncation for a small corpus', () => {
      writeLearning('a.md', '# A\n\nCovers: short.\n');
      const result = syncLearnings(temporaryDirectory);
      expect(result.descriptionTruncated).toBe(false);
    });
  });
});
