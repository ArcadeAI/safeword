/**
 * Verifies that every release-tracked manifest and Codex hook command uses
 * the CLI package version. This is called by pre-commit and release tests.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

interface VersionManifest {
  version?: unknown;
}

interface MarketplaceManifest {
  plugins?: VersionManifest[];
}

interface HooksManifest {
  hooks?: Record<string, Array<{ hooks?: Array<{ command?: unknown }> }>>;
}

const CODEX_HOOK_EVENTS = [
  'session-start',
  'pre-tool-use',
  'post-tool-use',
  'user-prompt-submit',
  'stop',
] as const;

function readJson<T>(relativePath: string): T {
  const filePath = nodePath.join(process.cwd(), relativePath);
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readVersion(value: unknown, location: string): string {
  if (typeof value !== 'string' || value === '') {
    fail(`Version sync check needs a version at ${location}.`);
  }
  return value;
}

function getHookCommands(manifest: HooksManifest): string[] {
  const commands: string[] = [];

  for (const entries of Object.values(manifest.hooks ?? {})) {
    for (const entry of entries) {
      for (const hook of entry.hooks ?? []) {
        if (typeof hook.command === 'string') commands.push(hook.command);
      }
    }
  }

  return commands;
}

const cli = readJson<VersionManifest>('packages/cli/package.json');
const marketplace = readJson<MarketplaceManifest>('.claude-plugin/marketplace.json');
const codexPlugin = readJson<VersionManifest>(
  'packages/cli/codex-plugin/.codex-plugin/plugin.json',
);
const codexHooks = readJson<HooksManifest>('packages/cli/codex-plugin/hooks.json');

const version = readVersion(cli.version, 'packages/cli/package.json');
const marketplaceVersion = readVersion(
  marketplace.plugins?.[0]?.version,
  '.claude-plugin/marketplace.json plugins[0].version',
);
const codexPluginVersion = readVersion(
  codexPlugin.version,
  'packages/cli/codex-plugin/.codex-plugin/plugin.json',
);

if (version !== marketplaceVersion || version !== codexPluginVersion) {
  fail(
    `Version mismatch: package.json=${version} marketplace.json=${marketplaceVersion} codex-plugin=${codexPluginVersion}. Update plugin manifests.`,
  );
}

const expectedCommands = new Set(
  CODEX_HOOK_EVENTS.map(event => `bunx --bun safeword@${version} hook codex ${event}`),
);
const hookCommands = getHookCommands(codexHooks);
const actualCommands = new Set(hookCommands);

if (
  hookCommands.length !== expectedCommands.size ||
  actualCommands.size !== expectedCommands.size ||
  [...expectedCommands].some(command => !actualCommands.has(command))
) {
  fail(
    `Version mismatch: packages/cli/codex-plugin/hooks.json must pin every Codex hook to safeword@${version}.`,
  );
}
