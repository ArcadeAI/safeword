import { spawnSync } from 'node:child_process';

import { type CliResult, createResult, type Effect } from '../cli-protocol/result.js';
import { SAFEWORD_SCHEMA } from '../schema.js';

const MINIMUM_CLAUDE_VERSION = [2, 1, 170] as const;
const MARKETPLACE_NAME = 'safeword';
const PLUGIN_ID = 'safeword@safeword';
const MARKETPLACE_BASE = 'https://github.com/ArcadeAI/safeword.git';

type JsonObject = Record<string, unknown>;

class ClaudeProfileError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly effects: readonly Effect[] = [],
  ) {
    super(message);
  }
}

function runClaude(cwd: string, arguments_: readonly string[], effects: readonly Effect[]): string {
  const result = spawnSync('claude', arguments_, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
    const detailSuffix = detail === '' ? '' : ` (${detail})`;
    throw new ClaudeProfileError(
      'CLAUDE_PROFILE_COMMAND_FAILED',
      `Claude command failed: claude ${arguments_.join(' ')}${detailSuffix}`,
      effects,
    );
  }
  return result.stdout ?? '';
}

function parseJsonArray(output: string, command: string, effects: readonly Effect[]): JsonObject[] {
  try {
    const value = JSON.parse(output) as unknown;
    if (!Array.isArray(value) || value.some(entry => typeof entry !== 'object' || entry === null)) {
      throw new TypeError('expected a JSON array of objects');
    }
    return value as JsonObject[];
  } catch (error) {
    throw new ClaudeProfileError(
      'CLAUDE_PROFILE_OUTPUT_INVALID',
      `Claude returned invalid JSON for ${command}: ${error instanceof Error ? error.message : String(error)}`,
      effects,
    );
  }
}

function versionAtLeast(version: readonly number[], minimum: readonly number[]): boolean {
  for (const [index, minimumComponent] of minimum.entries()) {
    const component = version[index] ?? -1;
    if (component !== minimumComponent) return component > minimumComponent;
  }
  return true;
}

function assertSupportedHost(cwd: string): void {
  const output = runClaude(cwd, ['--version'], []);
  const match = /^(\d+)\.(\d+)\.(\d+)/u.exec(output.trim());
  if (match === null) {
    throw new ClaudeProfileError(
      'CLAUDE_VERSION_UNSUPPORTED',
      `Could not parse the Claude Code version. Version ${MINIMUM_CLAUDE_VERSION.join('.')} or newer is required.`,
    );
  }
  const version = match.slice(1).map(Number);
  if (!versionAtLeast(version, MINIMUM_CLAUDE_VERSION)) {
    throw new ClaudeProfileError(
      'CLAUDE_VERSION_UNSUPPORTED',
      `Claude Code ${MINIMUM_CLAUDE_VERSION.join('.')} or newer is required; found ${version.join('.')}.`,
    );
  }
}

function officialMarketplaceSource(): string {
  return `${MARKETPLACE_BASE}#v${SAFEWORD_SCHEMA.version}`;
}

function sourceIsOfficial(entry: JsonObject): boolean {
  if (entry.source === officialMarketplaceSource()) return true;
  const source =
    typeof entry.source === 'object' && entry.source !== null
      ? (entry.source as JsonObject)
      : entry;
  const sourceKind = source.source;
  return (
    source.url === MARKETPLACE_BASE &&
    source.ref === `v${SAFEWORD_SCHEMA.version}` &&
    (sourceKind === undefined ||
      (typeof sourceKind === 'string' && ['url', 'git'].includes(sourceKind)))
  );
}

function marketplaceEntries(cwd: string, effects: readonly Effect[]): JsonObject[] {
  return parseJsonArray(
    runClaude(cwd, ['plugin', 'marketplace', 'list', '--json'], effects),
    'plugin marketplace list --json',
    effects,
  );
}

function pluginEntries(cwd: string, effects: readonly Effect[]): JsonObject[] {
  return parseJsonArray(
    runClaude(cwd, ['plugin', 'list', '--json'], effects),
    'plugin list --json',
    effects,
  );
}

function safewordMarketplace(entries: readonly JsonObject[]): JsonObject | undefined {
  return entries.find(entry => entry.name === MARKETPLACE_NAME);
}

function safewordPlugin(entries: readonly JsonObject[]): JsonObject | undefined {
  return entries.find(entry => entry.id === PLUGIN_ID);
}

function failedResult(error: unknown): CliResult {
  let failure: ClaudeProfileError;
  if (error instanceof ClaudeProfileError) failure = error;
  else {
    const message = error instanceof Error ? error.message : String(error);
    failure = new ClaudeProfileError('CLAUDE_PLUGIN_INSTALL_FAILED', message);
  }
  let classification = 'errored';
  let nextAction = 'safeword claude install';
  if (failure.code === 'CLAUDE_VERSION_UNSUPPORTED') {
    classification = 'unsupported-host';
    nextAction = 'claude update';
  } else if (failure.code === 'CLAUDE_MARKETPLACE_CONFLICT') {
    classification = 'marketplace-conflict';
    nextAction = `claude plugin marketplace add ${officialMarketplaceSource()} --scope user`;
  }
  return createResult({
    state: 'failed',
    changed: failure.effects.length > 0,
    effects: { configuration: failure.effects },
    errors: [{ code: failure.code, message: failure.message, retryable: true }],
    nextActions: [
      {
        command: nextAction,
        mutates: true,
        requiresHuman: true,
      },
    ],
    data: { command: 'claude install', classification },
  });
}

function ensureMarketplace(cwd: string, effects: Effect[]): void {
  let marketplace = safewordMarketplace(marketplaceEntries(cwd, effects));
  if (marketplace !== undefined && !sourceIsOfficial(marketplace)) {
    throw new ClaudeProfileError(
      'CLAUDE_MARKETPLACE_CONFLICT',
      `Claude marketplace ${MARKETPLACE_NAME} is configured from an unofficial source; expected ${officialMarketplaceSource()}.`,
    );
  }
  if (marketplace !== undefined) return;
  runClaude(
    cwd,
    ['plugin', 'marketplace', 'add', officialMarketplaceSource(), '--scope', 'user'],
    effects,
  );
  effects.push({ kind: 'add', target: MARKETPLACE_NAME, operation: 'user' });
  marketplace = safewordMarketplace(marketplaceEntries(cwd, effects));
  if (marketplace === undefined || !sourceIsOfficial(marketplace)) {
    throw new ClaudeProfileError(
      'CLAUDE_MARKETPLACE_UNVERIFIED',
      'Claude did not report the exact official Safeword marketplace after adding it.',
      effects,
    );
  }
}

function convergePlugin(cwd: string, effects: Effect[]): void {
  const plugin = safewordPlugin(pluginEntries(cwd, effects));
  if (plugin === undefined) {
    runClaude(cwd, ['plugin', 'install', PLUGIN_ID, '--scope', 'user'], effects);
    effects.push({ kind: 'install', target: PLUGIN_ID, operation: 'user' });
  } else if (plugin.version !== SAFEWORD_SCHEMA.version) {
    runClaude(cwd, ['plugin', 'update', PLUGIN_ID, '--scope', 'user'], effects);
    effects.push({ kind: 'update', target: PLUGIN_ID, operation: 'user' });
  } else if (plugin.enabled !== true) {
    runClaude(cwd, ['plugin', 'enable', PLUGIN_ID, '--scope', 'user'], effects);
    effects.push({ kind: 'enable', target: PLUGIN_ID, operation: 'user' });
  }
}

function verifyPlugin(cwd: string, effects: readonly Effect[]): void {
  const plugin = safewordPlugin(pluginEntries(cwd, effects));
  if (
    plugin?.version === SAFEWORD_SCHEMA.version &&
    plugin.enabled === true &&
    plugin.scope === 'user'
  ) {
    return;
  }
  throw new ClaudeProfileError(
    'CLAUDE_PLUGIN_UNVERIFIED',
    `Claude did not report ${PLUGIN_ID} ${SAFEWORD_SCHEMA.version} as enabled at user scope.`,
    effects,
  );
}

export function installClaudePlugin(cwd: string): CliResult {
  const effects: Effect[] = [];
  try {
    assertSupportedHost(cwd);
    ensureMarketplace(cwd, effects);
    convergePlugin(cwd, effects);
    verifyPlugin(cwd, effects);

    return createResult({
      state: effects.length === 0 ? 'healthy' : 'changed',
      effects: {
        configuration: effects,
        network: effects.map(effect => ({ ...effect, target: 'Claude plugin marketplace' })),
      },
      nextActions: [{ command: '/reload-plugins', mutates: false, requiresHuman: true }],
      data: {
        command: 'claude install',
        plugin: PLUGIN_ID,
        version: SAFEWORD_SCHEMA.version,
        scope: 'user',
      },
    });
  } catch (error) {
    return failedResult(error);
  }
}
