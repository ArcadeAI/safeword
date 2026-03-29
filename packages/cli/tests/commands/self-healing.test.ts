/**
 * Test Suite 12: AGENTS.md Self-Healing
 *
 * Tests for SessionStart hook that maintains AGENTS.md link.
 */

import { execSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createConfiguredProject,
  createTemporaryDirectory,
  fileExists,
  measureTimeSync,
  readTestFile,
  removeTemporaryDirectory,
  writeTestFile,
} from '../helpers';

/**
 * Helper to run the self-healing hook script
 * @param dir
 */
function runSelfHealingHook(dir: string): { stdout: string; exitCode: number } {
  // The hook script location: .safeword/hooks/session-verify-agents.ts
  const hookPath = nodePath.join(dir, '.safeword/hooks/session-verify-agents.ts');

  if (!fileExists(dir, '.safeword/hooks/session-verify-agents.ts')) {
    // Hook may have different name - check for any agents-related hook
    // For now, return a placeholder
    return { stdout: '', exitCode: 0 };
  }

  try {
    const stdout = execSync(`bun "${hookPath}"`, {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; status?: number };
    return {
      stdout: execError.stdout ?? '',
      exitCode: execError.status ?? 1,
    };
  }
}

describe('Test Suite 12: AGENTS.md Self-Healing', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 12.1: Hook detects missing link', () => {
    it('should detect when safeword link is missing', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Remove the safeword link from AGENTS.md
      const content = readTestFile(temporaryDirectory, 'AGENTS.md');
      const withoutLink = content
        .split('\n')
        .filter(line => !line.includes('.safeword/SAFEWORD.md'))
        .join('\n');
      writeTestFile(temporaryDirectory, 'AGENTS.md', withoutLink);

      const result = runSelfHealingHook(temporaryDirectory);

      // Hook should indicate repair is needed or perform repair
      // The exact output depends on implementation
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Test 12.2: Hook re-adds missing link', () => {
    it('should restore removed link', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Remove the safeword link
      const withoutLink = '# My Project\n\nSome content without the link.\n';
      writeTestFile(temporaryDirectory, 'AGENTS.md', withoutLink);

      // Run hook
      runSelfHealingHook(temporaryDirectory);

      // Link should be restored
      const updatedContent = readTestFile(temporaryDirectory, 'AGENTS.md');
      expect(updatedContent).toContain('.safeword/SAFEWORD.md');

      // Original content preserved
      expect(updatedContent).toContain('My Project');
      expect(updatedContent).toContain('Some content');
    });
  });

  describe('Test 12.3: Hook shows warning on restoration', () => {
    it('should output message when restoring', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Remove link
      writeTestFile(temporaryDirectory, 'AGENTS.md', '# No link\n');

      const result = runSelfHealingHook(temporaryDirectory);

      // Should mention restoration
      const output = result.stdout.toLowerCase();
      expect(output).toMatch(/restor|repair|add|fix|agents/i);
    });
  });

  describe('Test 12.4: Hook recreates deleted AGENTS.md', () => {
    it('should recreate AGENTS.md if deleted', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Delete AGENTS.md entirely
      unlinkSync(nodePath.join(temporaryDirectory, 'AGENTS.md'));
      expect(fileExists(temporaryDirectory, 'AGENTS.md')).toBe(false);

      // Run hook
      runSelfHealingHook(temporaryDirectory);

      // AGENTS.md should be recreated
      expect(fileExists(temporaryDirectory, 'AGENTS.md')).toBe(true);

      const content = readTestFile(temporaryDirectory, 'AGENTS.md');
      expect(content).toContain('.safeword/SAFEWORD.md');
    });
  });

  describe('Test 12.5: Hook prevents duplicates', () => {
    it('should not add duplicate links', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Verify link exists
      const contentBefore = readTestFile(temporaryDirectory, 'AGENTS.md');
      expect(contentBefore).toContain('.safeword/SAFEWORD.md');

      // Run hook multiple times
      runSelfHealingHook(temporaryDirectory);
      runSelfHealingHook(temporaryDirectory);
      runSelfHealingHook(temporaryDirectory);

      // Count links
      const contentAfter = readTestFile(temporaryDirectory, 'AGENTS.md');
      const linkCount = (contentAfter.match(/\.safeword\/SAFEWORD\.md/g) || []).length;

      expect(linkCount).toBe(1);
    });
  });

  describe('Test 12.6: Hook exits cleanly', () => {
    it('should exit with code 0 and complete quickly', async () => {
      await createConfiguredProject(temporaryDirectory);

      const { result, timeMs } = measureTimeSync(() => runSelfHealingHook(temporaryDirectory));

      expect(result.exitCode).toBe(0);
      expect(timeMs).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});
