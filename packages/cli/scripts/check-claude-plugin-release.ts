import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import packageJson from '../package.json' with { type: 'json' };

type JsonObject = Record<string, unknown>;

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const repoRoot = nodePath.resolve(packageRoot, '../..');
// Testability seam: the acceptance lane points this at a deliberately damaged
// copy of the plugin to prove the contract can actually FAIL. Unset in every
// real run, so release behaviour is unchanged.
const pluginRoot = process.env.SAFEWORD_CLAUDE_PLUGIN_ROOT ?? nodePath.join(repoRoot, 'plugin');

execFileSync('bun', ['scripts/generate-claude-historical-catalogue.ts', '--check'], {
  cwd: packageRoot,
  stdio: 'inherit',
});
execFileSync('bun', ['scripts/generate-claude-plugin.ts', '--check'], {
  cwd: packageRoot,
  stdio: 'inherit',
});

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(path, 'utf8')) as JsonObject;
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const marketplace = readJson(nodePath.join(repoRoot, '.claude-plugin/marketplace.json'));
const marketplacePlugins = marketplace.plugins as JsonObject[];
const identity = readJson(nodePath.join(pluginRoot, 'identity.json'));
const inventoryPath = nodePath.join(pluginRoot, 'inventory.json');
const inventory = readJson(inventoryPath);
const assets = inventory.assets as JsonObject[];

const versions = {
  package: packageJson.version,
  marketplace: marketplacePlugins[0]?.version,
  identity: identity.plugin_version,
};
if (new Set(Object.values(versions)).size !== 1) {
  throw new Error(`Claude plugin version drift: ${JSON.stringify(versions)}`);
}
if (identity.inventory_sha256 !== sha256(inventoryPath)) {
  throw new Error('Claude plugin inventory digest drifted from identity.json.');
}
const hookManifest = nodePath.join(pluginRoot, 'hooks/hooks.json');
if (identity.hook_manifest_sha256 !== sha256(hookManifest)) {
  throw new Error('Claude plugin hook manifest digest drifted from identity.json.');
}
for (const asset of assets) {
  if (typeof asset.path !== 'string' || typeof asset.sha256 !== 'string') {
    throw new TypeError('Claude plugin inventory contains a malformed asset.');
  }
  if (sha256(nodePath.join(pluginRoot, asset.path)) !== asset.sha256) {
    throw new Error(`Claude plugin packaged runtime asset drifted: ${asset.path}`);
  }
}
const dispatcher = readFileSync(nodePath.join(pluginRoot, 'runtime/dispatch.js'), 'utf8');
for (const proof of [
  'migrateClaudeLegacyAutomatically',
  'claimClaudeMigrationAttempt',
  'plugin-mode-v2.json',
]) {
  if (!dispatcher.includes(proof)) {
    throw new Error(`Claude plugin dispatcher is missing automatic migration wiring: ${proof}`);
  }
}
const documentation = [
  readFileSync(nodePath.join(repoRoot, 'README.md'), 'utf8'),
  readFileSync(nodePath.join(pluginRoot, 'README.md'), 'utf8'),
].join('\n');
for (const command of [
  'safeword install --agents=claude',
  'safeword claude status',
  'safeword claude cleanup',
  '/reload-plugins',
]) {
  if (!documentation.includes(command)) {
    throw new Error(`Claude plugin documentation is stale; missing ${command}.`);
  }
}

console.log(`Claude plugin release contract is aligned at ${packageJson.version}.`);
