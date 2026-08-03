import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { getTemplatesDirectory } from '../utils/fs.js';
import { CLAUDE_MIGRATION_SCHEMA } from './inventory.js';
import { type JsonObject, observeClaudeProfile } from './profile.js';

type ClaudeStatusClassification =
  | 'recovery-required'
  | 'unsupported-host'
  | 'missing'
  | 'disabled'
  | 'wrong-version'
  | 'errored'
  | 'unproven'
  | 'coexistence'
  | 'cleanup-ready'
  | 'plugin-mode';

interface LegacyObservation {
  readonly recognized: string[];
  readonly conflicts: string[];
}

function claudeConfigDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.CLAUDE_CONFIG_DIR ?? nodePath.join(homedir(), '.claude');
}

function isRegularFile(path: string): boolean {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

function jsonObject(path: string): JsonObject | undefined {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  } catch {
    return undefined;
  }
}

function proofIsCurrent(plugin: JsonObject): boolean {
  if (typeof plugin.installPath !== 'string') return false;
  const identity = jsonObject(nodePath.join(plugin.installPath, 'identity.json'));
  const proof = jsonObject(
    nodePath.join(claudeConfigDirectory(), CLAUDE_MIGRATION_SCHEMA.paths.proof),
  );
  if (identity === undefined || proof === undefined) return false;
  let canonicalRoot: string;
  try {
    canonicalRoot = realpathSync(plugin.installPath);
  } catch {
    return false;
  }
  return (
    proof.schema_version === 1 &&
    proof.plugin_version === SAFEWORD_SCHEMA.version &&
    proof.hook_manifest_sha256 === identity.hook_manifest_sha256 &&
    proof.canonical_plugin_root === canonicalRoot &&
    (proof.event === 'SessionStart' || proof.event === 'UserPromptSubmit')
  );
}

function legacyObservation(cwd: string): LegacyObservation {
  const recognized: string[] = [];
  const conflicts: string[] = [];
  const templates = getTemplatesDirectory();
  for (const [relative, definition] of Object.entries(SAFEWORD_SCHEMA.ownedFiles)) {
    if (!relative.startsWith('.claude/') || definition.template === undefined) continue;
    const installed = nodePath.join(cwd, relative);
    if (!existsSync(installed)) continue;
    if (!isRegularFile(installed)) {
      conflicts.push(relative);
      continue;
    }
    const canonical = nodePath.join(templates, definition.template);
    if (
      isRegularFile(canonical) &&
      createHash('sha256').update(readFileSync(installed)).digest('hex') ===
        createHash('sha256').update(readFileSync(canonical)).digest('hex')
    ) {
      recognized.push(relative);
    } else {
      conflicts.push(relative);
    }
  }
  return { recognized, conflicts };
}

const ACTIONS: Readonly<Record<ClaudeStatusClassification, string | undefined>> = {
  'recovery-required': 'safeword claude recover',
  'unsupported-host': undefined,
  missing: 'safeword claude install',
  disabled: 'safeword claude install',
  'wrong-version': 'safeword claude install',
  errored: 'repair the reported Claude plugin error',
  unproven: '/reload-plugins',
  coexistence: 'resolve reported legacy conflicts',
  'cleanup-ready': 'safeword claude cleanup',
  'plugin-mode': undefined,
};

function statusResult(
  classification: ClaudeStatusClassification,
  options: { nextAction?: string; message?: string; legacy?: LegacyObservation } = {},
): CliResult {
  const nextAction = options.nextAction ?? ACTIONS[classification];
  const failed = classification === 'errored';
  let state: CliResult['state'] = 'action_required';
  if (classification === 'plugin-mode') state = 'healthy';
  else if (failed) state = 'failed';
  return createResult({
    state,
    findings:
      options.message === undefined
        ? []
        : [
            {
              code: `CLAUDE_${classification.replaceAll('-', '_').toUpperCase()}`,
              message: options.message,
              severity: failed ? 'error' : 'warning',
            },
          ],
    nextActions:
      nextAction === undefined
        ? []
        : [{ command: nextAction, mutates: !nextAction.startsWith('/'), requiresHuman: true }],
    data: {
      command: 'claude status',
      classification,
      ...(options.legacy !== undefined && { legacy: options.legacy }),
    },
  });
}

export function observeClaudeStatus(cwd: string): CliResult {
  if (existsSync(nodePath.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.transaction))) {
    return statusResult('recovery-required');
  }
  const profile = observeClaudeProfile(cwd);
  if (profile.health !== 'current') {
    return statusResult(profile.health, {
      nextAction: profile.nextAction,
      message: profile.message,
    });
  }
  if (!proofIsCurrent(profile.plugin ?? {})) return statusResult('unproven');

  const legacy = legacyObservation(cwd);
  if (legacy.conflicts.length > 0) return statusResult('coexistence', { legacy });
  if (legacy.recognized.length > 0) return statusResult('cleanup-ready', { legacy });
  if (existsSync(nodePath.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarker))) {
    return statusResult('plugin-mode', { legacy });
  }
  return statusResult('coexistence', { legacy });
}
