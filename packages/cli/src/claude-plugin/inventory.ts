import { readdirSync } from 'node:fs';
import nodePath from 'node:path';
export const CLAUDE_PLUGIN_ID = 'safeword@safeword';

export const CLAUDE_MIGRATION_SCHEMA = {
  paths: {
    proof: 'plugins/data/safeword-safeword/execution-proof-v1.json',
    proofDirectory: 'plugins/data/safeword-safeword/execution-proofs-v2',
    pluginMarker: '.safeword/claude-plugin/plugin-mode-v1.json',
    pluginMarkerV2: '.safeword/claude-plugin/plugin-mode-v2.json',
    attention: '.safeword/claude-plugin/attention-v1.json',
    attemptsDirectory: '.safeword/claude-plugin/attempts-v1',
    transaction: '.safeword/claude-plugin/cleanup-transaction-v1.json',
  },
} as const;

/** Files required to authenticate and execute the native Claude delivery surface. */
export const CLAUDE_NATIVE_REQUIRED_ASSETS = [
  '.claude-plugin/plugin.json',
  'hooks/hooks.json',
  'runtime/cli.js',
  'runtime/dispatch.js',
  'runtime/event-groups.json',
] as const;

export const CLAUDE_NATIVE_METADATA_FILES = [
  'README.md',
  'identity.json',
  'inventory.json',
] as const;

const BENIGN_CACHE_METADATA_BASENAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

/** Enumerate files without following untrusted symlinks in an installed plugin cache. */
export function claudeNativePayloadFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (physicalDirectory: string, logicalDirectory: string): void => {
    const entries = readdirSync(physicalDirectory, { withFileTypes: true });
    for (const entry of entries) {
      // Claude owns this root-level lease directory and rotates PID markers
      // while sessions use the cached plugin. It is host metadata, not payload.
      if (logicalDirectory === '' && entry.isDirectory() && entry.name === '.in_use') continue;
      const physicalPath = nodePath.join(physicalDirectory, entry.name);
      const logicalPath =
        logicalDirectory === '' ? entry.name : nodePath.posix.join(logicalDirectory, entry.name);
      // Symlinks are returned as leaf paths. Callers must reject them with lstat
      // when listed, or as unexpected paths when they are absent from inventory.
      if (entry.isDirectory()) visit(physicalPath, logicalPath);
      else if (!BENIGN_CACHE_METADATA_BASENAMES.has(entry.name)) files.push(logicalPath);
    }
  };
  visit(root, '');
  return files;
}
