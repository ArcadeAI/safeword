import { chmodSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

const trustedReviewerDirectories = new Set<string>();

export function cleanupTrustedReviewerDirectories(): void {
  for (const directory of trustedReviewerDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
  trustedReviewerDirectories.clear();
}

/**
 * What a compatible reviewer advertises when asked what it supports.
 *
 * Fake reviewers must advertise every flag the runtime requires, or candidate
 * selection discards them and a test fails as `not_installed` for reasons that
 * have nothing to do with what it is testing. Adding a required capability
 * used to mean editing nine copies of these strings; it is one edit here.
 *
 * `--model` is included because the alternate-model route asks for it, even
 * though the runtime does not require it for selection.
 */
export const REVIEWER_CAPABILITIES = {
  claude: [
    '--output-format',
    '--json-schema',
    '--no-session-persistence',
    '--disable-slash-commands',
    '--setting-sources',
    '--strict-mcp-config',
    '--tools',
    '--model',
  ].join(' '),
  codex: [
    '--json',
    '--sandbox',
    '--skip-git-repo-check',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--disable',
    '--config',
    '--model',
    '--output-schema',
  ].join(' '),
  opencode: ['--format', '--pure', '--model'].join(' '),
} as const satisfies Record<'claude' | 'codex' | 'opencode', string>;

/**
 * Reviewer discovery deliberately rejects executables beneath writable
 * ancestry such as /tmp. Put positive-path fake binaries under a private,
 * current-user-owned directory so tests exercise the real trust policy instead
 * of bypassing it. Rejection tests should continue to use ordinary temp roots.
 */
export function createTrustedReviewerDirectory(prefix: string): string {
  const root = nodePath.join(homedir(), '.cache', 'safeword-test-reviewers');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  chmodSync(root, 0o700);
  const directory = mkdtempSync(nodePath.join(root, prefix));
  trustedReviewerDirectories.add(directory);
  return directory;
}
