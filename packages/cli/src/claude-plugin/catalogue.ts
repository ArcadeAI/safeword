import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { buildSync } from 'esbuild';

import { generateOwnedPathsModule } from '../owned-paths.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { SETTINGS_HOOKS } from '../templates/config.js';
import { adaptHookValue, pluginHookManifest, pluginSessionStartEntries } from './hook-manifest.js';

export interface GeneratedClaudePluginAsset {
  readonly relativePath: string;
  readonly content: string;
}

interface ClaudePluginCatalogueInput {
  readonly cliBundle: string;
  readonly sourceRoot: string;
  readonly templatesRoot: string;
  readonly version: string;
}

const GENERATED_DIRECTORIES = [
  '.claude-plugin',
  'agents',
  'commands',
  'hooks',
  'resources',
  'runtime',
  'skills',
] as const;
const BUN_INSTALL_INSTANCE_PATH =
  /([/\\]node_modules[/\\]\.bun[/\\][^/\\\r\n]+)\+[0-9a-f]{16}([/\\]node_modules[/\\])/giu;

/**
 * Bun includes content-addressed install instance suffixes in bundle source comments.
 * They vary between otherwise equivalent installs, so remove them before sealing the
 * generated plugin catalogue.
 */
export function normalizeClaudePluginCliBundle(bundle: string): string {
  return bundle
    .replaceAll(BUN_INSTALL_INSTANCE_PATH, '$1$2')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
}

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

function adaptProjectFrameworkDirectory(
  content: string,
  projectDirectory: string,
  pluginDirectory: string,
): string {
  return content
    .replaceAll(
      `"$PROJECT_DIR/.safeword/${projectDirectory}/`,
      () => `"\${CLAUDE_PLUGIN_ROOT}/${pluginDirectory}/`,
    )
    .replaceAll(
      `$PROJECT_DIR/.safeword/${projectDirectory}/`,
      () => `"\${CLAUDE_PLUGIN_ROOT}"/${pluginDirectory}/`,
    )
    .replaceAll(
      `./.safeword/${projectDirectory}/`,
      () => `"\${CLAUDE_PLUGIN_ROOT}"/${pluginDirectory}/`,
    )
    .replaceAll(
      `.safeword/${projectDirectory}/`,
      () => `"\${CLAUDE_PLUGIN_ROOT}"/${pluginDirectory}/`,
    );
}

function adaptWorkflowReference(content: string): string {
  let adapted = adaptProjectFrameworkDirectory(content, 'hooks', 'runtime/hooks');
  adapted = adaptProjectFrameworkDirectory(adapted, 'guides', 'resources/guides');
  adapted = adaptProjectFrameworkDirectory(adapted, 'templates', 'resources/templates');
  adapted = adaptProjectFrameworkDirectory(adapted, 'scripts', 'resources/scripts');
  return adaptProjectFrameworkDirectory(adapted, 'skills', 'skills');
}

/**
 * Claude Code evaluates a skill's `!` command before it expands it. Recent
 * clients reject command substitution there, so the host-neutral project-root
 * fallback (`$(git rev-parse … || pwd)`) never reaches the proof helper.
 * Native Claude plugin sessions always provide CLAUDE_PROJECT_DIR; rewrite only
 * inline skill commands to use that host contract directly.
 */
function adaptClaudeSkill(content: string): string {
  const adapted = adaptWorkflowReference(content)
    .replaceAll('`/verify`', '`/safeword:verify`')
    .replaceAll('`/retro-filer`', '`/safeword:retro-filer`')
    .replaceAll(
      '!`PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" && ',
      '!`',
    );
  return stripTrailingWhitespace(
    adapted.replaceAll(
      /^!`([^`\n]*)`$/gmu,
      (_line, command: string) =>
        `!\`${command.replaceAll('$PROJECT_DIR', '$CLAUDE_PROJECT_DIR')}\``,
    ),
  );
}

function adaptPluginScriptReference(content: string): string {
  return adaptWorkflowReference(content).replaceAll(
    "from '../hooks/",
    "from '../../runtime/hooks/",
  );
}

function adaptPluginRuntime(content: string): string {
  const adapted = adaptWorkflowReference(content)
    .replaceAll(
      "['bunx', ['safeword@latest',",
      "['bun', [process.env.SAFEWORD_PLUGIN_CLI ?? localCli,",
    )
    .replaceAll('`bunx safeword@latest`', 'the bundled plugin CLI');
  if (
    adapted.includes('process.env.SAFEWORD_PLUGIN_CLI ?? localCli') &&
    !/\b(?:const|let|var)\s+localCli\b/u.test(adapted)
  ) {
    throw new Error('Claude plugin runtime adaptation requires a localCli fallback binding.');
  }
  // Runtime hooks are TypeScript. A project path inside a template literal is
  // rewritten to the plugin shell placeholder, but an unescaped `${...}` would
  // become JavaScript interpolation of a nonexistent global. Keep it literal so
  // Claude/the user's shell can expand the host-provided environment variable.
  return adapted.replaceAll('${CLAUDE_PLUGIN_ROOT}', () => '\\${CLAUDE_PLUGIN_ROOT}');
}

const PROJECT_FRAMEWORK_REFERENCE =
  /(?:\.\/)?\.safeword\/(?:hooks|guides|scripts|skills|templates)\/[^\s)`'"<>]*/u;

function invocationName(asset: GeneratedClaudePluginAsset): string | undefined {
  const skillDirectory = /^skills\/([^/]+)\/SKILL\.md$/u.exec(asset.relativePath)?.[1];
  if (skillDirectory !== undefined) {
    return /^---\n[\s\S]*?^name:\s*(\S+)\s*$/mu.exec(asset.content)?.[1] ?? skillDirectory;
  }
  return /^commands\/([^/]+)\.md$/u.exec(asset.relativePath)?.[1];
}

function assertUniqueInvocations(assets: readonly GeneratedClaudePluginAsset[]): void {
  const invocationSources = new Map<string, string>();
  for (const asset of assets) {
    const invocation = invocationName(asset);
    if (invocation === undefined) continue;
    const existing = invocationSources.get(invocation);
    if (existing !== undefined) {
      throw new Error(
        `Duplicate Claude plugin invocation ${invocation}: ${existing} and ${asset.relativePath}`,
      );
    }
    invocationSources.set(invocation, asset.relativePath);
  }
}

function assertNoProjectFrameworkReferences(assets: readonly GeneratedClaudePluginAsset[]): void {
  for (const asset of assets) {
    if (
      [
        'runtime/cli.js',
        'runtime/dispatch.js',
        'runtime/hooks/lib/cursor-run-identity.ts',
      ].includes(asset.relativePath)
    )
      continue;
    if (!/^(?:agents|commands|resources|runtime|skills)\//u.test(asset.relativePath)) continue;
    const dependency = PROJECT_FRAMEWORK_REFERENCE.exec(asset.content)?.[0];
    if (dependency === undefined) continue;
    throw new Error(
      `Claude plugin asset ${asset.relativePath} depends on project framework path ${dependency}`,
    );
  }
}

export function assertClaudePluginAssetReferences(
  assets: readonly GeneratedClaudePluginAsset[],
): void {
  assertUniqueInvocations(assets);
  assertNoProjectFrameworkReferences(assets);
}

const PLUGIN_ROOT_REFERENCE = /\\?\$\{CLAUDE_PLUGIN_ROOT\}(?:\\?"\/|\/)([\w*./-]+)/gu;
const RELATIVE_MODULE_REFERENCE = /(?:from\s+|import\s*\()['"](\.[^'"]+)['"]/gu;

function stripReferencePunctuation(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  let end = value.length;
  while (end > 0 && '.,;:'.includes(value[end - 1] ?? '')) end -= 1;
  return value.slice(0, end);
}

function referencedPluginPaths(asset: GeneratedClaudePluginAsset): string[] {
  if (asset.relativePath === 'runtime/cli.js' || asset.relativePath === 'runtime/dispatch.js') {
    return [];
  }
  const references = asset.content
    .matchAll(PLUGIN_ROOT_REFERENCE)
    .map(match => stripReferencePunctuation(match[1]))
    .toArray();
  for (const match of asset.content.matchAll(RELATIVE_MODULE_REFERENCE)) {
    const reference = match[1];
    if (reference === undefined) continue;
    const referrerDirectory = nodePath.dirname(asset.relativePath);
    const joinedReference = nodePath.join(referrerDirectory, reference);
    references.push(nodePath.normalize(joinedReference));
  }
  return references.filter((reference): reference is string => reference !== undefined);
}

function resolveReference(
  reference: string,
  candidates: ReadonlyMap<string, GeneratedClaudePluginAsset>,
): string[] {
  if (reference.endsWith('/')) {
    return candidates
      .keys()
      .filter(path => path.startsWith(reference))
      .toArray();
  }
  if (reference.includes('*')) {
    if (reference.indexOf('*') !== reference.lastIndexOf('*')) return [];
    const [prefix = '', suffix = ''] = reference.split('*', 2);
    return candidates
      .keys()
      .filter(path => path.startsWith(prefix) && path.endsWith(suffix))
      .toArray();
  }
  if (candidates.has(reference)) return [reference];
  if (reference.endsWith('.js')) {
    const typescriptPath = `${reference.slice(0, -3)}.ts`;
    if (candidates.has(typescriptPath)) return [typescriptPath];
  }
  if (candidates.has(`${reference}.ts`)) return [`${reference}.ts`];
  return [];
}

function isCatalogueRoot(asset: GeneratedClaudePluginAsset): boolean {
  return (
    /^(?:agents|commands|skills)\//u.test(asset.relativePath) ||
    asset.relativePath === '.claude-plugin/plugin.json' ||
    asset.relativePath === 'hooks/hooks.json' ||
    asset.relativePath === 'runtime/dispatch.js' ||
    asset.relativePath === 'runtime/event-groups.json' ||
    asset.relativePath === 'runtime/cli.js' ||
    asset.relativePath === 'package.json'
  );
}

function enqueueReference(
  reference: string,
  referrer: string,
  candidates: ReadonlyMap<string, GeneratedClaudePluginAsset>,
  selected: Set<string>,
  queue: string[],
): void {
  const resolved = resolveReference(reference, candidates);
  if (resolved.length === 0) {
    throw new Error(
      `Claude plugin asset ${referrer} references missing packaged dependency ${reference}`,
    );
  }
  for (const path of resolved) {
    if (selected.has(path)) {
      continue;
    }

    selected.add(path);
    queue.push(path);
  }
}

function transitiveClaudePluginAssets(
  candidates: readonly GeneratedClaudePluginAsset[],
): GeneratedClaudePluginAsset[] {
  const byPath = new Map(candidates.map(asset => [asset.relativePath, asset]));
  const selected = new Set(
    candidates.filter(asset => isCatalogueRoot(asset)).map(asset => asset.relativePath),
  );
  const queue = [...selected];
  for (const referrer of queue) {
    const asset = byPath.get(referrer);
    if (asset === undefined) continue;
    for (const reference of referencedPluginPaths(asset)) {
      enqueueReference(reference, referrer, byPath, selected, queue);
    }
  }
  return candidates.filter(asset => selected.has(asset.relativePath));
}

export function assertClaudePluginAssetClosure(
  assets: readonly GeneratedClaudePluginAsset[],
): void {
  transitiveClaudePluginAssets(assets);
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
  return directoryAssets(nodePath.join(templatesRoot, 'hooks'), 'runtime/hooks')
    .filter(asset => {
      const relativeHookPath = nodePath.relative('runtime/hooks', asset.relativePath);
      const hostDirectory = relativeHookPath.split(nodePath.sep, 1)[0];
      return hostDirectory !== 'codex' && hostDirectory !== 'cursor';
    })
    .map(asset => ({
      ...asset,
      content: asset.relativePath.endsWith('lib/cursor-run-identity.ts')
        ? asset.content
        : adaptPluginRuntime(asset.content),
    }));
}

function pluginEventGroups(): string {
  const adapted = adaptHookValue(SETTINGS_HOOKS) as Record<string, unknown>;
  const sessionStart = pluginSessionStartEntries(adapted);
  const groups = Object.fromEntries(
    ['SessionStart', 'UserPromptSubmit'].map(event => [
      event,
      event === 'SessionStart' ? sessionStart : (adapted[event] ?? []),
    ]),
  );
  return `${JSON.stringify({ schema_version: 1, groups }, undefined, 2)}\n`;
}

function pluginInventory(assets: readonly GeneratedClaudePluginAsset[]): string {
  return `${JSON.stringify(
    {
      schema_version: 1,
      assets: assets.map(asset => ({
        path: asset.relativePath,
        sha256: createHash('sha256').update(asset.content).digest('hex'),
      })),
    },
    undefined,
    2,
  )}\n`;
}

function pluginManifest(): string {
  // Keep arrays on one line to match the repository's Prettier output. The
  // manifest is part of the sealed payload, so a later formatting pass must be
  // byte-for-byte idempotent rather than invalidating the inventory.
  const keywords = ['bdd', 'tdd', 'linting', 'quality-review', 'debugging', 'refactoring'];
  const keywordsPlaceholder = '__SAFEWORD_PLUGIN_KEYWORDS__';
  const skillsPlaceholder = '__SAFEWORD_PLUGIN_SKILLS__';
  const formattedKeywords = `[${keywords.map(keyword => JSON.stringify(keyword)).join(', ')}]`;
  const formattedSkills = '["./skills"]';
  return `${JSON.stringify(
    {
      name: 'safeword',
      description:
        'AI coding agent workflows: BDD, auto-linting, quality reviews, debugging, and refactoring. Start a new session to auto-install, or run /safeword:setup.',
      author: { name: 'safeword' },
      homepage: 'https://safeword.dev',
      repository: 'https://github.com/ArcadeAI/safeword',
      license: 'MIT',
      skills: skillsPlaceholder,
      keywords: keywordsPlaceholder,
    },
    undefined,
    2,
  )
    .replace(JSON.stringify(skillsPlaceholder), () => formattedSkills)
    .replace(JSON.stringify(keywordsPlaceholder), () => formattedKeywords)}\n`;
}

function pluginIdentity(version: string, hookManifest: string, inventory: string): string {
  return `${JSON.stringify(
    {
      schema_version: 1,
      plugin_version: version,
      hook_manifest_sha256: createHash('sha256').update(hookManifest).digest('hex'),
      inventory_sha256: createHash('sha256').update(inventory).digest('hex'),
    },
    undefined,
    2,
  )}\n`;
}

function bundledDispatcher(sourceRoot: string): string {
  const result = buildSync({
    absWorkingDir: sourceRoot,
    entryPoints: ['claude-plugin/runtime/dispatch.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    write: false,
    legalComments: 'none',
    mainFields: ['module', 'main'],
  });
  const output = result.outputFiles[0]?.text;
  if (output === undefined) throw new Error('Claude plugin dispatcher bundle was not generated.');
  return output;
}

export function generateClaudePluginAssets(
  input: ClaudePluginCatalogueInput,
): GeneratedClaudePluginAsset[] {
  const { cliBundle, sourceRoot, templatesRoot, version } = input;
  const hookManifest = pluginHookManifest();
  const eventGroups = pluginEventGroups();
  const candidateAssets = [
    {
      relativePath: '.claude-plugin/plugin.json',
      content: pluginManifest(),
    },
    {
      relativePath: 'package.json',
      content: `${JSON.stringify({ name: 'safeword', version, type: 'module' }, undefined, 2)}\n`,
    },
    ...directoryAssets(nodePath.join(templatesRoot, 'skills'), 'skills', adaptClaudeSkill),
    ...directoryAssets(nodePath.join(templatesRoot, 'agents'), 'agents', adaptWorkflowReference),
    ...claudeHookAssets(templatesRoot),
    {
      relativePath: nodePath.join('runtime', 'hooks', 'lib', 'owned-paths.ts'),
      content: generateOwnedPathsModule(SAFEWORD_SCHEMA),
    },
    {
      relativePath: nodePath.join('resources', 'SAFEWORD.md'),
      content: adaptWorkflowReference(
        readFileSync(nodePath.join(templatesRoot, 'SAFEWORD.md'), 'utf8'),
      ),
    },
    ...directoryAssets(
      nodePath.join(templatesRoot, 'guides'),
      'resources/guides',
      adaptWorkflowReference,
    ),
    ...directoryAssets(
      nodePath.join(templatesRoot, 'scripts'),
      'resources/scripts',
      adaptPluginScriptReference,
    ),
    ...directoryAssets(
      nodePath.join(templatesRoot, 'doc-templates'),
      'resources/templates',
      content => adaptWorkflowReference(stripTrailingWhitespace(content)),
    ),
    ...directoryAssets(nodePath.join(sourceRoot, 'claude-plugin', 'runtime'), 'runtime').filter(
      asset => asset.relativePath !== 'runtime/dispatch.ts',
    ),
    { relativePath: 'runtime/dispatch.js', content: bundledDispatcher(sourceRoot) },
    { relativePath: nodePath.join('runtime', 'cli.js'), content: cliBundle },
    { relativePath: nodePath.join('runtime', 'event-groups.json'), content: eventGroups },
    { relativePath: nodePath.join('hooks', 'hooks.json'), content: hookManifest },
  ];

  const contentAssets = transitiveClaudePluginAssets(candidateAssets);
  assertClaudePluginAssetReferences(contentAssets);
  const inventory = pluginInventory(
    contentAssets.toSorted((left, right) => left.relativePath.localeCompare(right.relativePath)),
  );
  const assets = [
    ...contentAssets,
    { relativePath: 'inventory.json', content: inventory },
    {
      relativePath: 'identity.json',
      content: pluginIdentity(version, hookManifest, inventory),
    },
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

/**
 * Asserts a generated plugin tree matches its canonical sources exactly: every
 * expected asset present and byte-identical, and no unexpected generated file
 * left behind. Exercised by the delivery-schema suite.
 */
export function assertClaudePluginCatalogue(
  input: ClaudePluginCatalogueInput,
  pluginRoot: string,
): void {
  const expectedAssets = generateClaudePluginAssets(input);
  for (const asset of expectedAssets) {
    const path = nodePath.join(pluginRoot, asset.relativePath);
    if (!existsSync(path))
      throw new Error(`Claude plugin is missing expected asset: ${asset.relativePath}`);
    if (readFileSync(path, 'utf8') !== asset.content) {
      throw new Error(`Claude plugin asset differs from canonical source: ${asset.relativePath}`);
    }
  }
  const expectedPaths = new Set(expectedAssets.map(asset => asset.relativePath));
  for (const directory of GENERATED_DIRECTORIES) {
    const generatedDirectory = nodePath.join(pluginRoot, directory);
    const actualPaths = filesBeneath(generatedDirectory, directory);
    for (const relativePath of actualPaths) {
      if (!expectedPaths.has(relativePath)) {
        throw new Error(`Claude plugin has unexpected generated asset: ${relativePath}`);
      }
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
  rmSync(nodePath.join(pluginRoot, 'inventory.json'), { force: true });
  rmSync(nodePath.join(pluginRoot, 'package.json'), { force: true });

  for (const asset of assets) {
    const path = nodePath.join(pluginRoot, asset.relativePath);
    mkdirSync(nodePath.dirname(path), { recursive: true });
    writeFileSync(path, asset.content);
  }
  return assets;
}

export function sealClaudePluginCatalogue(pluginRoot: string, version: string): void {
  const paths = [
    'package.json',
    ...GENERATED_DIRECTORIES.flatMap(directory =>
      filesBeneath(nodePath.join(pluginRoot, directory), directory),
    ),
  ].toSorted((left, right) => left.localeCompare(right));
  const assets = paths.map(relativePath => ({
    relativePath,
    content: readFileSync(nodePath.join(pluginRoot, relativePath), 'utf8'),
  }));
  const inventory = pluginInventory(assets);
  const hookManifest = readFileSync(nodePath.join(pluginRoot, 'hooks', 'hooks.json'), 'utf8');
  writeFileSync(nodePath.join(pluginRoot, 'inventory.json'), inventory);
  writeFileSync(
    nodePath.join(pluginRoot, 'identity.json'),
    pluginIdentity(version, hookManifest, inventory),
  );
}
