/**
 * Verifies that every release-tracked manifest uses the CLI package version
 * and every Codex hook uses the bundled plugin runtime. This is called by
 * pre-commit and release tests.
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

const CODEX_HOOK_EVENTS = {
  SessionStart: 'session-start',
  PreToolUse: 'pre-tool-use',
  PostToolUse: 'post-tool-use',
  UserPromptSubmit: 'user-prompt-submit',
  Stop: 'stop',
} as const;

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

function getHookCommands(manifest: HooksManifest, event: string): string[] {
  const commands: string[] = [];

  for (const entry of manifest.hooks?.[event] ?? []) {
    for (const hook of entry.hooks ?? []) {
      if (typeof hook.command === 'string') commands.push(hook.command);
    }
  }

  return commands;
}

const cli = readJson<VersionManifest>('packages/cli/package.json');
const marketplace = readJson<MarketplaceManifest>('.claude-plugin/marketplace.json');
const codexPlugin = readJson<VersionManifest>(
  'packages/cli/codex-plugin/.codex-plugin/plugin.json',
);
const codexRuntimePackage = readJson<VersionManifest>('packages/cli/codex-plugin/package.json');
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
const codexRuntimeVersion = readVersion(
  codexRuntimePackage.version,
  'packages/cli/codex-plugin/package.json',
);

if (
  version !== marketplaceVersion ||
  version !== codexPluginVersion ||
  version !== codexRuntimeVersion
) {
  fail(
    `Version mismatch: package.json=${version} marketplace.json=${marketplaceVersion} codex-plugin=${codexPluginVersion} codex-runtime=${codexRuntimeVersion}. Update plugin manifests and regenerate plugin runtimes.`,
  );
}

for (const [manifestEvent, cliEvent] of Object.entries(CODEX_HOOK_EVENTS)) {
  const expectedCommand = `bun "\${PLUGIN_ROOT}/runtime/cli.js" hook codex ${cliEvent} --plugin-hook`;
  const commands = getHookCommands(codexHooks, manifestEvent);
  if (commands.length !== 1 || commands[0] !== expectedCommand) {
    fail(
      `Runtime mismatch: packages/cli/codex-plugin/hooks.json must bind ${manifestEvent} to its bundled CLI command.`,
    );
  }
}
