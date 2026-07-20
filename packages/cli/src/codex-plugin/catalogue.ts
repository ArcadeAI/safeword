import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse, stringify } from 'yaml';

export interface GeneratedPluginAsset {
  relativePath: string;
  content: string;
}

export const CODEX_SKILL_METADATA_LIMIT = 8000;

interface CanonicalSkillMetadata extends Record<string, unknown> {
  name?: unknown;
  description?: unknown;
}

interface CanonicalSkillAsset {
  relativePath: string;
  skill: string;
  filename: string;
}

const FRONTMATTER = /^---\r?\n(?<metadata>[\s\S]*?)\r?\n---\r?\n/u;
const SUPPORTED_SOURCE_METADATA = new Set([
  'name',
  'description',
  'allowed-tools',
  'disallowed-tools',
  'disable-model-invocation',
  'effort',
  'user-invocable',
]);

function markdownFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const relativePath = nodePath.join(prefix, entry.name);
      const absolutePath = nodePath.join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(absolutePath, relativePath);
      return entry.isFile() && entry.name.endsWith('.md') ? [relativePath] : [];
    })
    .toSorted((left, right) => left.localeCompare(right));
}

function canonicalSkillPath(relativePath: string): { skill: string; filename: string } {
  const [skill, filename, ...rest] = relativePath.split(nodePath.sep);
  if (skill === undefined || filename === undefined || rest.length > 0) {
    throw new Error(`unexpected canonical skill path: ${relativePath}`);
  }
  return { skill, filename };
}

function isCanonicalSkillMetadata(value: unknown): value is CanonicalSkillMetadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFrontmatter(content: string): { body: string; metadata: unknown } | undefined {
  const frontmatter = FRONTMATTER.exec(content);
  if (frontmatter?.groups?.metadata === undefined) return undefined;

  return {
    body: content.slice(frontmatter[0].length),
    metadata: parse(frontmatter.groups.metadata),
  };
}

function parseSkill(content: string, skill: string): { body: string; description: string } {
  const frontmatter = readFrontmatter(content);
  if (frontmatter === undefined) {
    throw new Error(`canonical skill ${skill} has no YAML frontmatter`);
  }

  const { metadata } = frontmatter;
  if (!isCanonicalSkillMetadata(metadata)) {
    throw new Error(`canonical skill ${skill} has invalid metadata`);
  }

  const unsupportedMetadata = Object.keys(metadata).find(
    key => !SUPPORTED_SOURCE_METADATA.has(key),
  );
  if (unsupportedMetadata !== undefined) {
    throw new Error(`canonical skill ${skill} has unsupported metadata: ${unsupportedMetadata}`);
  }

  if (metadata.name !== skill || typeof metadata.description !== 'string') {
    throw new Error(`canonical skill ${skill} has invalid name or description metadata`);
  }

  return {
    body: frontmatter.body,
    description: metadata.description,
  };
}

function isAsciiLowercase(character: string): boolean {
  return character >= 'a' && character <= 'z';
}

function isAsciiUppercase(character: string): boolean {
  return character >= 'A' && character <= 'Z';
}

function isAsciiDigit(character: string): boolean {
  return character >= '0' && character <= '9';
}

function isWorkflowNameCharacter(character: string): boolean {
  return isAsciiLowercase(character) || character === '-';
}

function isWorkflowPathExtensionStart(character: string): boolean {
  return (
    isAsciiLowercase(character) ||
    isAsciiUppercase(character) ||
    isAsciiDigit(character) ||
    character === '_' ||
    character === '-'
  );
}

function isWorkflowInvocationPrefix(character: string | undefined): boolean {
  return (
    character === undefined ||
    (!isWorkflowNameCharacter(character) &&
      !isAsciiDigit(character) &&
      character !== '_' &&
      character !== '/')
  );
}

function hasWorkflowPathSuffix(markdown: string, nameEnd: number): boolean {
  const suffix = markdown[nameEnd];
  const firstPathCharacter = markdown[nameEnd + 1] ?? '';
  return suffix === '/' || (suffix === '.' && isWorkflowPathExtensionStart(firstPathCharacter));
}

function hasWorkflowInvocationBoundary(markdown: string, nameEnd: number): boolean {
  const next = markdown[nameEnd];
  return (
    next === undefined || (!isWorkflowNameCharacter(next) && !isAsciiDigit(next) && next !== '_')
  );
}

function adaptWorkflowInvocations(markdown: string, knownSkillNames: ReadonlySet<string>): string {
  let adapted = '';
  let copiedThrough = 0;
  let slash = markdown.indexOf('/');

  while (slash !== -1) {
    const nameStart = slash + 1;
    let nameEnd = nameStart;
    while (isWorkflowNameCharacter(markdown[nameEnd] ?? '')) nameEnd += 1;
    const name = markdown.slice(nameStart, nameEnd);

    if (
      isAsciiLowercase(name[0] ?? '') &&
      isWorkflowInvocationPrefix(markdown[slash - 1]) &&
      knownSkillNames.has(name) &&
      !hasWorkflowPathSuffix(markdown, nameEnd) &&
      hasWorkflowInvocationBoundary(markdown, nameEnd)
    ) {
      adapted += `${markdown.slice(copiedThrough, slash)}$safeword:${name}`;
      copiedThrough = nameEnd;
    }
    slash = markdown.indexOf('/', slash + 1);
  }

  return `${adapted}${markdown.slice(copiedThrough)}`;
}

function adaptWorkflowMarkdown(markdown: string, knownSkillNames: ReadonlySet<string>): string {
  const adapted = adaptWorkflowInvocations(markdown, knownSkillNames);

  return formatMarkdownTables(adapted);
}

function adaptSkillBody(
  body: string,
  knownSkillNames: ReadonlySet<string>,
  referenceNames: string[],
): string {
  // Canonical skills have one blank line after frontmatter. The generated
  // frontmatter supplies that separator, so avoid duplicating it here.
  let adapted = body.replace(/^\r?\n/u, '');
  for (const referenceName of referenceNames) {
    adapted = adapted.split(referenceName).join(`references/${referenceName}`);
  }

  return adaptWorkflowMarkdown(adapted, knownSkillNames);
}

function tableCells(line: string): string[] {
  return line
    .slice(1, -1)
    .split('|')
    .map(cell => cell.trim());
}

function isTableDelimiter(cells: string[], columnCount: number): boolean {
  return cells.length === columnCount && cells.every(cell => /^:?-{3,}:?$/u.test(cell));
}

function formatMarkdownTable(rows: string[][]): string[] {
  const contentRows = rows.filter((_, rowIndex) => rowIndex !== 1);
  const widths = rows[0]?.map((headerCell, column) =>
    Math.max(headerCell.length, ...contentRows.map(cells => cells[column]?.length ?? 0)),
  );
  if (widths === undefined) return [];

  return rows.map((cells, row) => {
    const formattedCells = cells.map((cell, column) => {
      const width = widths[column];
      if (width === undefined) throw new Error('Markdown table has an invalid column width');
      return row === 1 ? '-'.repeat(Math.max(3, width)) : cell.padEnd(width);
    });
    return `| ${formattedCells.join(' | ')} |`;
  });
}

/** Keep transformed Markdown tables stable under the repository's Prettier config. */
function formatMarkdownTables(markdown: string): string {
  const lines = markdown.split('\n');

  for (let start = 0; start < lines.length; start += 1) {
    const header = lines[start];
    const delimiter = lines[start + 1];
    if (header === undefined || delimiter === undefined || !header.startsWith('|')) continue;

    const headerCells = tableCells(header);
    if (!isTableDelimiter(tableCells(delimiter), headerCells.length)) continue;

    let end = start + 2;
    while (lines[end]?.startsWith('|') === true) end += 1;
    const rows = lines.slice(start, end).map(line => tableCells(line));
    if (rows.some(cells => cells.length !== headerCells.length)) continue;

    lines.splice(start, end - start, ...formatMarkdownTable(rows));
    start = end - 1;
  }

  return lines.join('\n');
}

/**
 * Adapt the canonical skill corpus into Codex's plugin layout. Only the source
 * metadata, explicit workflow invocations, and sibling reference paths change.
 */
export function generateCodexPluginAssets(
  canonicalSkillsDirectory: string,
): GeneratedPluginAsset[] {
  const canonicalAssets: CanonicalSkillAsset[] = markdownFiles(canonicalSkillsDirectory).map(
    relativePath => ({ relativePath, ...canonicalSkillPath(relativePath) }),
  );
  const knownSkillNames = new Set(canonicalAssets.map(asset => asset.skill));
  const referenceNamesBySkill = new Map<string, string[]>();

  for (const asset of canonicalAssets) {
    if (asset.filename === 'SKILL.md') continue;
    const referenceNames = referenceNamesBySkill.get(asset.skill) ?? [];
    referenceNames.push(asset.filename);
    referenceNamesBySkill.set(asset.skill, referenceNames);
  }

  return canonicalAssets.map(({ relativePath, skill, filename }) => {
    const content = readFileSync(nodePath.join(canonicalSkillsDirectory, relativePath), 'utf8');
    if (filename !== 'SKILL.md') {
      return {
        relativePath: nodePath.join('skills', skill, 'references', filename),
        content: adaptWorkflowMarkdown(content, knownSkillNames),
      };
    }

    const { body, description } = parseSkill(content, skill);
    const referenceNames = referenceNamesBySkill.get(skill) ?? [];

    return {
      relativePath: nodePath.join('skills', skill, 'SKILL.md'),
      content: `---\n${stringify({
        name: skill,
        description: adaptWorkflowInvocations(description, knownSkillNames),
      }).trimEnd()}\n---\n\n${adaptSkillBody(body, knownSkillNames, referenceNames)}`,
    };
  });
}

function skillMetadataLength(asset: GeneratedPluginAsset): number {
  if (!asset.relativePath.endsWith(nodePath.join('SKILL.md'))) return 0;
  const frontmatter = readFrontmatter(asset.content);
  if (frontmatter === undefined) {
    throw new Error(`generated skill ${asset.relativePath} has no YAML frontmatter`);
  }
  const { metadata } = frontmatter;
  if (
    !isCanonicalSkillMetadata(metadata) ||
    typeof metadata.name !== 'string' ||
    typeof metadata.description !== 'string'
  ) {
    throw new Error(
      `generated skill ${asset.relativePath} has invalid name or description metadata`,
    );
  }

  // Codex's initial skill list contains each skill's name, description, and file path.
  return metadata.name.length + metadata.description.length + asset.relativePath.length;
}

export function codexSkillMetadataCharacters(assets: GeneratedPluginAsset[]): number {
  return assets.reduce((total, asset) => total + skillMetadataLength(asset), 0);
}

export function assertCodexSkillMetadataBudget(assets: GeneratedPluginAsset[]): void {
  const characters = codexSkillMetadataCharacters(assets);
  if (characters > CODEX_SKILL_METADATA_LIMIT) {
    throw new Error(
      `Generated Codex skill metadata is ${characters} characters; limit is ${CODEX_SKILL_METADATA_LIMIT}.`,
    );
  }
}

function expectedAssetPaths(assets: GeneratedPluginAsset[]): Set<string> {
  return new Set(assets.map(asset => asset.relativePath));
}

function pluginAssetPaths(pluginDirectory: string): string[] {
  const skillsDirectory = nodePath.join(pluginDirectory, 'skills');
  if (!existsSync(skillsDirectory)) return [];
  return markdownFiles(skillsDirectory).map(relativePath => nodePath.join('skills', relativePath));
}

// All three failures below mean the checked-in catalogue no longer matches its
// canonical source, and share one remedy. The non-obvious trigger is a merge:
// git combines an edit to templates/skills/ with an untouched generated plugin
// cleanly, because they are different files — it has no notion that one derives
// from the other.
const REGENERATE_REMEDY = 'Regenerate it with `bun run --cwd packages/cli generate:codex-plugin`.';

/** Ensure the checked-in plugin is the exact allowed transformation of canonical skills. */
export function assertCodexPluginCatalogue(
  canonicalSkillsDirectory: string,
  pluginDirectory: string,
): void {
  const expectedAssets = generateCodexPluginAssets(canonicalSkillsDirectory);
  assertCodexSkillMetadataBudget(expectedAssets);

  const expectedPaths = expectedAssetPaths(expectedAssets);
  const actualPaths = pluginAssetPaths(pluginDirectory);
  const missingPath = [...expectedPaths].find(path => !actualPaths.includes(path));
  if (missingPath !== undefined) {
    throw new Error(`Codex plugin is missing expected asset: ${missingPath}\n${REGENERATE_REMEDY}`);
  }

  const unexpectedPath = actualPaths.find(path => !expectedPaths.has(path));
  if (unexpectedPath !== undefined) {
    throw new Error(`Codex plugin has unexpected asset: ${unexpectedPath}\n${REGENERATE_REMEDY}`);
  }

  for (const asset of expectedAssets) {
    const actualPath = nodePath.join(pluginDirectory, asset.relativePath);
    const actualContent = readFileSync(actualPath, 'utf8');
    if (actualContent !== asset.content) {
      throw new Error(
        `Codex plugin asset differs from the canonical transformation: ${asset.relativePath}\n${REGENERATE_REMEDY}`,
      );
    }
  }
}

export function writeCodexPluginCatalogue(
  canonicalSkillsDirectory: string,
  pluginDirectory: string,
): GeneratedPluginAsset[] {
  const assets = generateCodexPluginAssets(canonicalSkillsDirectory);
  const skillsDirectory = nodePath.join(pluginDirectory, 'skills');
  rmSync(skillsDirectory, { recursive: true, force: true });

  for (const asset of assets) {
    const destination = nodePath.join(pluginDirectory, asset.relativePath);
    mkdirSync(nodePath.dirname(destination), { recursive: true });
    writeFileSync(destination, asset.content);
  }

  return assets;
}
