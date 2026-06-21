/**
 * Test Suite: Setup - Template Bundling (Story 1)
 *
 * Tests for the "self-contained templates" feature.
 * The CLI should bundle full methodology files (not stubs) so
 * `bunx safeword setup` works without external dependencies.
 *
 * First 3 tests FAIL until Story 1 is implemented.
 */

import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

describe('Setup - Template Bundling (Story 1)', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  it('should install full SAFEWORD.md (not a stub)', async () => {
    createTypeScriptPackageJson(temporaryDirectory);
    initGitRepo(temporaryDirectory);

    await runCli(['setup'], { cwd: temporaryDirectory });

    expect(fileExists(temporaryDirectory, '.safeword/SAFEWORD.md')).toBe(true);

    const content = readTestFile(temporaryDirectory, '.safeword/SAFEWORD.md');
    // Full file is ~31KB, stub is <1KB
    expect(content.length).toBeGreaterThan(1000);
    // Verify it's the full methodology file, not a stub
    expect(content).toContain('# SAFEWORD Agent Instructions');
  });

  it('should install methodology guides to .safeword/guides/', async () => {
    createTypeScriptPackageJson(temporaryDirectory);
    initGitRepo(temporaryDirectory);

    await runCli(['setup'], { cwd: temporaryDirectory });

    expect(fileExists(temporaryDirectory, '.safeword/guides')).toBe(true);

    const guidesDirectory = nodePath.join(temporaryDirectory, '.safeword/guides');
    const mdFiles = readdirSync(guidesDirectory).filter(f => f.endsWith('.md'));

    expect(mdFiles.length).toBeGreaterThan(0);
  });

  it('should install document templates', async () => {
    createTypeScriptPackageJson(temporaryDirectory);
    initGitRepo(temporaryDirectory);

    await runCli(['setup'], { cwd: temporaryDirectory });

    expect(fileExists(temporaryDirectory, '.safeword/templates')).toBe(true);

    const templatesDirectory = nodePath.join(temporaryDirectory, '.safeword/templates');
    const mdFiles = readdirSync(templatesDirectory).filter(f => f.endsWith('.md'));

    expect(mdFiles.length).toBeGreaterThan(0);
  });

  it('should install review prompts to .safeword/prompts/', async () => {
    createTypeScriptPackageJson(temporaryDirectory);
    initGitRepo(temporaryDirectory);

    await runCli(['setup'], { cwd: temporaryDirectory });

    expect(fileExists(temporaryDirectory, '.safeword/prompts')).toBe(true);

    const promptsDirectory = nodePath.join(temporaryDirectory, '.safeword/prompts');
    const mdFiles = readdirSync(promptsDirectory).filter(f => f.endsWith('.md'));

    // Should have 2 review prompts
    expect(mdFiles.length).toBeGreaterThan(0);
  });

  it('should block re-run and preserve user content', async () => {
    createTypeScriptPackageJson(temporaryDirectory);
    initGitRepo(temporaryDirectory);

    await runCli(['setup'], { cwd: temporaryDirectory });

    // Create user content
    writeTestFile(
      temporaryDirectory,
      '.safeword/learnings/my-learning.md',
      '# My Learning\n\nImportant info.',
    );

    // Re-run setup should exit with error (already configured)
    const result = await runCli(['setup'], {
      cwd: temporaryDirectory,
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Already configured');

    // User content should be untouched
    expect(fileExists(temporaryDirectory, '.safeword/learnings/my-learning.md')).toBe(true);
    const content = readTestFile(temporaryDirectory, '.safeword/learnings/my-learning.md');
    expect(content).toContain('My Learning');
  });

  it('should have no broken internal links in installed templates', async () => {
    createTypeScriptPackageJson(temporaryDirectory);
    initGitRepo(temporaryDirectory);

    await runCli(['setup'], { cwd: temporaryDirectory });

    // Collect all markdown files in .safeword/
    const safewordDirectory = nodePath.join(temporaryDirectory, '.safeword');
    const allMdFiles: string[] = [];

    /**
     *
     * @param dir
     */
    function collectMdFiles(dir: string) {
      if (!fileExists(temporaryDirectory, dir.replace(`${temporaryDirectory}/`, ''))) return;
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = nodePath.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectMdFiles(fullPath);
        } else if (entry.name.endsWith('.md')) {
          allMdFiles.push(fullPath);
        }
      }
    }

    collectMdFiles(safewordDirectory);

    // Must have at least SAFEWORD.md with links to verify
    expect(allMdFiles.length).toBeGreaterThan(0);

    // Extract all .safeword/ links and verify targets exist
    // Pattern: .safeword/path.md - stop at whitespace, backticks, quotes, parens, or markdown formatting
    const linkPattern = /\.safeword\/[\w\-/]+\.md/g;
    const brokenLinks: { file: string; link: string }[] = [];
    let totalLinks = 0;

    // Patterns for example/placeholder links that shouldn't be validated
    const examplePatterns = [
      /XXX/, // Template placeholders like XXX-feature-name.md
      /file\.md$/, // Generic "file.md" examples in docs
      /learnings\//, // Example learning file paths in documentation
    ];

    const collectBrokenLinksForFile = (
      mdFile: string,
      links: string[],
    ): { file: string; link: string }[] => {
      const broken: { file: string; link: string }[] = [];
      for (const link of links) {
        // Skip example/placeholder links
        if (examplePatterns.some(p => p.test(link))) {
          continue;
        }

        // The link is already a relative path like .safeword/path.md
        const relativePath = link;

        if (!fileExists(temporaryDirectory, relativePath)) {
          broken.push({
            file: mdFile.replace(`${temporaryDirectory}/`, ''),
            link,
          });
        }
      }
      return broken;
    };

    for (const mdFile of allMdFiles) {
      const content = readFileSync(mdFile, 'utf8');
      const links = content.match(linkPattern) || [];
      totalLinks += links.length;

      brokenLinks.push(...collectBrokenLinksForFile(mdFile, links));
    }

    // Report all broken links
    if (brokenLinks.length > 0) {
      const report = brokenLinks.map(b => `  ${b.file}: ${b.link}`).join('\n');
      expect.fail(`Found ${brokenLinks.length} broken links:\n${report}`);
    }

    // Should have found at least some links to validate
    expect(totalLinks).toBeGreaterThan(0);
  });
});
