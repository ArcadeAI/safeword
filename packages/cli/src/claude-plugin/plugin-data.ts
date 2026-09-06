import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { CLAUDE_MIGRATION_SCHEMA, CLAUDE_PLUGIN_ID } from './inventory.js';
import { canonicalClaudeProjectRoot } from './project-root.js';

/**
 * Resolves the Claude user-scope configuration directory. An empty or
 * whitespace-only `CLAUDE_CONFIG_DIR` falls back to the default, so every
 * caller watches and reads the same user settings file.
 */
export function claudeConfigDirectory(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const configured = (environment.CLAUDE_CONFIG_DIR ?? '').trim();
  return configured === '' ? nodePath.join(homedir(), '.claude') : configured;
}

/**
 * Claude Code names a plugin's data directory after its id with every character
 * outside `[A-Za-z0-9_-]` replaced. Deriving it here — rather than writing
 * `safeword-safeword` into a path literal — is what keeps the CLI reading the
 * directory the plugin runtime writes to (issue #3788).
 */
export function claudePluginDataId(pluginId: string = CLAUDE_PLUGIN_ID): string {
  return pluginId.replaceAll(/[^\w-]/gu, '-');
}

/**
 * The plugin's persistent data directory.
 *
 * Inside a hook the host exports `CLAUDE_PLUGIN_DATA` and that is authoritative:
 * it is the only value that stays correct if Claude ever moves the directory.
 * The CLI runs outside any hook, so it reconstructs the documented location from
 * the config directory and the sanitized plugin id.
 */
export function claudePluginDataDirectory(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const exported = (environment.CLAUDE_PLUGIN_DATA ?? '').trim();
  if (exported !== '') return exported;
  return nodePath.join(
    claudeConfigDirectory(environment),
    CLAUDE_MIGRATION_SCHEMA.data.pluginsRoot,
    claudePluginDataId(),
  );
}

/** Stable per-project key: the digest of the canonical project root. */
export function claudeProjectDigest(canonicalProjectRoot: string): string {
  return createHash('sha256').update(canonicalProjectRoot).digest('hex');
}

/** Directory holding this plugin's durable execution proofs, one file per project. */
export function claudeProofDirectory(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return nodePath.join(claudePluginDataDirectory(environment), CLAUDE_MIGRATION_SCHEMA.data.proofs);
}

/**
 * Per-project plugin state, kept in the plugin's data directory rather than in
 * the customer's working tree (issue #3787). Claude Code documents the data
 * directory as the place plugin state belongs, and removes it on uninstall.
 *
 * Throws when the project root cannot be resolved; callers that must not fail
 * a session over it use {@link claudeProjectStateDirectoryOrUndefined}.
 */
export function claudeProjectStateDirectory(cwd: string): string {
  const canonical = canonicalClaudeProjectRoot(cwd);
  return nodePath.join(
    claudePluginDataDirectory(),
    CLAUDE_MIGRATION_SCHEMA.data.projectState,
    claudeProjectDigest(canonical),
  );
}

export function claudeProjectStateDirectoryOrUndefined(cwd: string): string | undefined {
  try {
    return claudeProjectStateDirectory(cwd);
  } catch {
    return undefined;
  }
}
