import { existsSync, readFileSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { VERSION } from '../version.js';
import { currentClaudePluginHookManifestSha256 } from './hook-manifest.js';
import {
  type ClaudeLegacyObservation,
  legacyObservationIsEmpty,
  observeClaudeLegacy,
} from './legacy-classifier.js';
import { claudeProjectStatePath } from './migration-state.js';
import { claudeProjectDigest, claudeProofDirectory } from './plugin-data.js';
import {
  type ClaudeApplicablePluginsObservation,
  type ClaudePluginScope,
  type JsonObject,
  observeApplicableClaudePlugins,
} from './profile.js';
import { canonicalClaudeProjectRoot } from './project-root.js';

type ClaudeStatusClassification =
  | 'recovery-required'
  | 'unsupported-host'
  | 'missing'
  | 'disabled'
  | 'wrong-version'
  | 'errored'
  | 'unproven'
  | 'scope-overlap'
  | 'coexistence'
  | 'cleanup-ready'
  | 'plugin-mode';

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

function timestampIsCanonical(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function proofMatches(
  proof: JsonObject,
  identity: JsonObject,
  plugin: JsonObject,
  canonicalProjectRoot: string,
  canonicalPluginRoot: string,
): boolean {
  return [
    proof.schema_version === 2,
    proof.project_root === canonicalProjectRoot,
    proof.plugin_version === VERSION,
    proof.plugin_version === plugin.version,
    proof.hook_manifest_sha256 === identity.hook_manifest_sha256,
    proof.hook_manifest_sha256 === currentClaudePluginHookManifestSha256(),
    proof.canonical_plugin_root === canonicalPluginRoot,
    proof.event === 'SessionStart' || proof.event === 'UserPromptSubmit',
    typeof proof.session_id === 'string' && proof.session_id !== '',
    timestampIsCanonical(proof.recorded_at),
  ].every(Boolean);
}

function proofIsCurrent(plugin: JsonObject, cwd: string): boolean {
  if (typeof plugin.installPath !== 'string') return false;
  const identity = jsonObject(nodePath.join(plugin.installPath, 'identity.json'));
  let canonicalRoot: string;
  let canonicalProjectRoot: string;
  try {
    canonicalRoot = realpathSync(plugin.installPath);
    canonicalProjectRoot = canonicalClaudeProjectRoot(cwd);
  } catch {
    return false;
  }
  const proof = jsonObject(
    nodePath.join(claudeProofDirectory(), `${claudeProjectDigest(canonicalProjectRoot)}.json`),
  );
  if (identity === undefined || proof === undefined) return false;
  return proofMatches(proof, identity, plugin, canonicalProjectRoot, canonicalRoot);
}

const ACTIONS: Readonly<Record<ClaudeStatusClassification, string | undefined>> = {
  'recovery-required': 'safeword claude recover',
  'unsupported-host': undefined,
  missing: 'safeword install --agents=claude',
  disabled: 'safeword install --agents=claude',
  'wrong-version': 'safeword install --agents=claude',
  errored: 'repair the reported Claude plugin error',
  unproven: '/reload-plugins',
  'scope-overlap': undefined,
  coexistence: 'resolve reported legacy conflicts',
  'cleanup-ready': 'safeword claude cleanup',
  'plugin-mode': undefined,
};

interface StatusOptions {
  readonly nextAction?: string;
  readonly message?: string;
  readonly legacy?: ClaudeLegacyObservation;
  readonly applicableScope?: ClaudePluginScope;
  readonly installations?: readonly {
    scope: ClaudePluginScope;
    health: string;
    plugin: JsonObject;
  }[];
  readonly nextActions?: readonly string[];
}

function statusData(
  classification: ClaudeStatusClassification,
  options: StatusOptions,
): Record<string, unknown> {
  const data: Record<string, unknown> = { command: 'claude status', classification };
  if (options.applicableScope !== undefined) data.applicable_scope = options.applicableScope;
  if (options.legacy !== undefined) {
    data.legacy = {
      recognized: options.legacy.recognizedFiles,
      conflicts: options.legacy.conflictingFiles,
      recognized_hooks: options.legacy.recognizedHooks,
      conflicting_hooks: options.legacy.conflictingHooks,
      ...(options.legacy.settingsError !== undefined && {
        settings_error: options.legacy.settingsError,
      }),
    };
  }
  if (options.installations !== undefined) {
    data.installations = options.installations.map(({ scope, health, plugin }) => ({
      scope,
      health,
      id: plugin.id,
      version: plugin.version,
      enabled: plugin.enabled,
      install_path: plugin.installPath,
      ...(scope === 'project' && { project_path: plugin.projectPath }),
    }));
  }
  return data;
}

function statusMessage(options: StatusOptions): string | undefined {
  if (options.message !== undefined) return options.message;
  if (options.applicableScope === undefined) return undefined;
  return `Safeword's applicable Claude installation is configured at ${options.applicableScope} scope for this repository.`;
}

function statusFindings(
  classification: ClaudeStatusClassification,
  options: StatusOptions,
  failed: boolean,
): CliResult['findings'] {
  const message = statusMessage(options);
  if (message === undefined) return [];
  let severity: 'error' | 'info' | 'warning' = 'warning';
  if (failed) severity = 'error';
  else if (classification === 'plugin-mode') severity = 'info';
  return [
    {
      code: `CLAUDE_${classification.replaceAll('-', '_').toUpperCase()}`,
      message,
      severity,
    },
  ];
}

function statusResult(
  classification: ClaudeStatusClassification,
  options: StatusOptions = {},
): CliResult {
  const nextAction = options.nextAction ?? ACTIONS[classification];
  const nextActions = options.nextActions ?? (nextAction === undefined ? [] : [nextAction]);
  const failed = classification === 'errored';
  let state: CliResult['state'] = 'action_required';
  if (classification === 'plugin-mode') state = 'healthy';
  else if (failed) state = 'failed';
  return createResult({
    state,
    findings: statusFindings(classification, options, failed),
    nextActions: nextActions.map(command => ({
      command,
      mutates: !command.startsWith('/'),
      requiresHuman: true,
    })),
    data: statusData(classification, options),
  });
}

export function equivalentClaudeInstallations(
  installations: ClaudeApplicablePluginsObservation['installations'],
): boolean {
  const [first, ...rest] = installations;
  if (first?.health !== 'current') return false;
  return rest.every(installation => {
    if (installation.health !== 'current') return false;
    const left = first.plugin;
    const right = installation.plugin;
    if (
      left.id !== right.id ||
      left.version !== right.version ||
      left.enabled !== right.enabled ||
      typeof left.installPath !== 'string' ||
      typeof right.installPath !== 'string'
    ) {
      return false;
    }
    try {
      return realpathSync(left.installPath) === realpathSync(right.installPath);
    } catch {
      return false;
    }
  });
}

function scopeOverlapResult(
  installations: ClaudeApplicablePluginsObservation['installations'],
): CliResult | undefined {
  if (new Set(installations.map(installation => installation.scope)).size <= 1) return undefined;
  if (equivalentClaudeInstallations(installations)) return undefined;
  const summary = installations
    .map(installation => `${installation.scope} (${installation.health})`)
    .join(' and ');
  return statusResult('scope-overlap', {
    installations,
    message: `Safeword has overlapping Claude installations for this repository: ${summary}. Keep one by running either \`claude plugin uninstall safeword@safeword --scope project\` or \`claude plugin uninstall safeword@safeword --scope user\`.`,
    nextActions: [
      'claude plugin uninstall safeword@safeword --scope project',
      'claude plugin uninstall safeword@safeword --scope user',
    ],
  });
}

function statusForInstallation(
  installation: ClaudeApplicablePluginsObservation['installations'][number],
  projectRoot: string,
): CliResult {
  if (installation.health !== 'current') {
    return statusResult(installation.health, {
      nextAction: installation.nextAction,
      message: installation.message,
      applicableScope: installation.scope,
    });
  }
  if (!proofIsCurrent(installation.plugin, projectRoot)) {
    return statusResult('unproven', { applicableScope: installation.scope });
  }
  const legacy = observeClaudeLegacy(projectRoot);
  if (legacy.recognizedFiles.length > 0 || legacy.recognizedHooks.length > 0) {
    return statusResult('cleanup-ready', { legacy, applicableScope: installation.scope });
  }
  if (!legacyObservationIsEmpty(legacy)) {
    return statusResult('coexistence', { legacy, applicableScope: installation.scope });
  }
  return statusResult('plugin-mode', { legacy, applicableScope: installation.scope });
}

export function observeClaudeStatus(cwd: string): CliResult {
  let projectRoot: string;
  try {
    projectRoot = canonicalClaudeProjectRoot(cwd);
  } catch (error) {
    return statusResult('errored', {
      message: error instanceof Error ? error.message : String(error),
      nextAction: 'repair the reported Claude project path',
    });
  }
  if (existsSync(claudeProjectStatePath(projectRoot, 'transaction'))) {
    return statusResult('recovery-required');
  }
  const profile = observeApplicableClaudePlugins(projectRoot);
  if (profile.status !== 'observed') {
    return statusResult(profile.status, {
      nextAction: profile.nextAction,
      message: profile.message,
    });
  }
  const overlap = scopeOverlapResult(profile.installations);
  if (overlap !== undefined) return overlap;
  const installation =
    profile.installations.find(candidate => candidate.scope === 'project') ??
    profile.installations.find(candidate => candidate.scope === 'user');
  if (installation === undefined) return statusResult('missing');
  return statusForInstallation(installation, projectRoot);
}
