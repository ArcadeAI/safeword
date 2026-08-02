import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { SETTINGS_HOOKS } from '../templates/config.js';

export interface GeneratedClaudePluginAsset {
  readonly relativePath: string;
  readonly content: string;
}

interface ClaudePluginCatalogueInput {
  readonly sourceRoot: string;
  readonly templatesRoot: string;
  readonly version: string;
}

const GENERATED_DIRECTORIES = ['agents', 'resources', 'runtime', 'skills'] as const;
const PROJECT_HOOK_ROOT = '"$CLAUDE_PROJECT_DIR"/.safeword/hooks';
const PLUGIN_HOOK_ROOT = '"${CLAUDE_PLUGIN_ROOT}"/runtime/hooks';
const PLUGIN_DISPATCH = 'bun "${CLAUDE_PLUGIN_ROOT}"/runtime/dispatch.ts';

function filesBeneath(directory: string, prefix = ''): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const relativePath = nodePath.join(prefix, entry.name);
      const absolutePath = nodePath.join(directory, entry.name);
      if (entry.isDirectory()) return filesBeneath(absolutePath, relativePath);
      return entry.isFile() ? [relativePath] : [];
    })
    .toSorted((left, right) => left.localeCompare(right));
}

function adaptWorkflowReference(content: string): string {
  return content
    .replaceAll('./.safeword/guides/', '${CLAUDE_PLUGIN_ROOT}/resources/guides/')
    .replaceAll('.safeword/guides/', '${CLAUDE_PLUGIN_ROOT}/resources/guides/')
    .replaceAll('./.safeword/templates/', '${CLAUDE_PLUGIN_ROOT}/resources/templates/')
    .replaceAll('.safeword/templates/', '${CLAUDE_PLUGIN_ROOT}/resources/templates/')
    .replaceAll('./.safeword/scripts/', '${CLAUDE_PLUGIN_ROOT}/resources/scripts/');
}

function stripTrailingWhitespace(content: string): string {
  return content
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
}

function directoryAssets(
  sourceDirectory: string,
  destinationDirectory: string,
  transform: (content: string) => string = content => content,
): GeneratedClaudePluginAsset[] {
  return filesBeneath(sourceDirectory).map(relativePath => ({
    relativePath: nodePath.join(destinationDirectory, relativePath),
    content: transform(readFileSync(nodePath.join(sourceDirectory, relativePath), 'utf8')),
  }));
}

function claudeHookAssets(templatesRoot: string): GeneratedClaudePluginAsset[] {
  return directoryAssets(nodePath.join(templatesRoot, 'hooks'), 'runtime/hooks').filter(asset => {
    const relativeHookPath = nodePath.relative('runtime/hooks', asset.relativePath);
    const hostDirectory = relativeHookPath.split(nodePath.sep, 1)[0];
    return hostDirectory !== 'codex' && hostDirectory !== 'cursor';
  });
}

function adaptHookValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replaceAll(PROJECT_HOOK_ROOT, () => PLUGIN_HOOK_ROOT);
  }
  if (Array.isArray(value)) return value.map(child => adaptHookValue(child));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, adaptHookValue(child)]),
  );
}

function wrapHookCommands(value: unknown, event: string): unknown {
  if (Array.isArray(value)) return value.map(child => wrapHookCommands(child, event));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === 'command' && typeof child === 'string'
        ? `${PLUGIN_DISPATCH} ${event} -- ${child}`
        : wrapHookCommands(child, event),
    ]),
  );
}

function pluginHooks(): Record<string, unknown> {
  const adapted = adaptHookValue(SETTINGS_HOOKS) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(adapted).map(([event, entries]) => [event, wrapHookCommands(entries, event)]),
  );
}

function pluginHookManifest(): string {
  const hooks = pluginHooks();
  return `${JSON.stringify({ hooks }, undefined, 2)}\n`;
}

function pluginIdentity(version: string, hookManifest: string): string {
  return `${JSON.stringify(
    {
      schema_version: 1,
      plugin_version: version,
      hook_manifest_sha256: createHash('sha256').update(hookManifest).digest('hex'),
    },
    undefined,
    2,
  )}\n`;
}

export function generateClaudePluginAssets(
  input: ClaudePluginCatalogueInput,
): GeneratedClaudePluginAsset[] {
  const { sourceRoot, templatesRoot, version } = input;
  const hookManifest = pluginHookManifest();
  const assets = [
    ...directoryAssets(nodePath.join(templatesRoot, 'skills'), 'skills', adaptWorkflowReference),
    ...directoryAssets(nodePath.join(templatesRoot, 'agents'), 'agents', adaptWorkflowReference),
    ...claudeHookAssets(templatesRoot),
    ...directoryAssets(nodePath.join(templatesRoot, 'guides'), 'resources/guides'),
    ...directoryAssets(nodePath.join(templatesRoot, 'scripts'), 'resources/scripts'),
    ...directoryAssets(
      nodePath.join(templatesRoot, 'doc-templates'),
      'resources/templates',
      stripTrailingWhitespace,
    ),
    ...directoryAssets(nodePath.join(sourceRoot, 'claude-plugin', 'runtime'), 'runtime'),
    { relativePath: nodePath.join('hooks', 'hooks.json'), content: hookManifest },
    { relativePath: 'identity.json', content: pluginIdentity(version, hookManifest) },
  ];

  const duplicate = assets.find(
    (asset, index) =>
      assets.findIndex(candidate => candidate.relativePath === asset.relativePath) !== index,
  );
  if (duplicate !== undefined) {
    throw new Error(`Duplicate generated Claude plugin asset: ${duplicate.relativePath}`);
  }
  return assets.toSorted((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function assertClaudePluginCatalogue(
  input: ClaudePluginCatalogueInput,
  pluginRoot: string,
): void {
  for (const asset of generateClaudePluginAssets(input)) {
    const path = nodePath.join(pluginRoot, asset.relativePath);
    if (!existsSync(path))
      throw new Error(`Claude plugin is missing expected asset: ${asset.relativePath}`);
    if (readFileSync(path, 'utf8') !== asset.content) {
      throw new Error(`Claude plugin asset differs from canonical source: ${asset.relativePath}`);
    }
  }
}

export function writeClaudePluginCatalogue(
  input: ClaudePluginCatalogueInput,
  pluginRoot: string,
): GeneratedClaudePluginAsset[] {
  const assets = generateClaudePluginAssets(input);
  for (const directory of GENERATED_DIRECTORIES) {
    rmSync(nodePath.join(pluginRoot, directory), { recursive: true, force: true });
  }
  rmSync(nodePath.join(pluginRoot, 'identity.json'), { force: true });
  rmSync(nodePath.join(pluginRoot, 'hooks', 'hooks.json'), { force: true });

  for (const asset of assets) {
    const path = nodePath.join(pluginRoot, asset.relativePath);
    mkdirSync(nodePath.dirname(path), { recursive: true });
    writeFileSync(path, asset.content);
  }
  return assets;
}
