import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse, stringify } from 'yaml';

export interface GeneratedPluginAsset {
  relativePath: string;
  content: string;
}

interface CanonicalSkillMetadata {
  name?: unknown;
  description?: unknown;
}

const FRONTMATTER = /^---\r?\n(?<metadata>[\s\S]*?)\r?\n---\r?\n/u;

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

function parseSkill(content: string, skill: string): { body: string; description: string } {
  const frontmatter = FRONTMATTER.exec(content);
  if (frontmatter?.groups?.metadata === undefined) {
    throw new Error(`canonical skill ${skill} has no YAML frontmatter`);
  }

  const metadata = parse(frontmatter.groups.metadata) as CanonicalSkillMetadata;
  if (metadata.name !== skill || typeof metadata.description !== 'string') {
    throw new Error(`canonical skill ${skill} has invalid name or description metadata`);
  }

  return {
    body: content.slice(frontmatter[0].length),
    description: metadata.description,
  };
}

function adaptSkillBody(body: string, skillNames: string[], referenceNames: string[]): string {
  let adapted = body;
  for (const referenceName of referenceNames) {
    adapted = adapted.split(referenceName).join(`references/${referenceName}`);
  }

  const knownSkillNames = new Set(skillNames);
  return adapted.replaceAll(
    /(^|[^\w-])\/([a-z][a-z-]*)\b/gu,
    (match, prefix: string, name: string) =>
      knownSkillNames.has(name) ? `${prefix}$safeword:${name}` : match,
  );
}

/**
 * Adapt the canonical skill corpus into Codex's plugin layout. Only the source
 * metadata, explicit workflow invocations, and sibling reference paths change.
 */
export function generateCodexPluginAssets(
  canonicalSkillsDirectory: string,
): GeneratedPluginAsset[] {
  const canonicalFiles = markdownFiles(canonicalSkillsDirectory);
  const skillNames = canonicalFiles
    .map(relativePath => canonicalSkillPath(relativePath).skill)
    .filter((value, index, values) => values.indexOf(value) === index);

  return canonicalFiles.map(relativePath => {
    const { skill, filename } = canonicalSkillPath(relativePath);
    const content = readFileSync(nodePath.join(canonicalSkillsDirectory, relativePath), 'utf8');
    if (filename !== 'SKILL.md') {
      return {
        relativePath: nodePath.join('skills', skill, 'references', filename),
        content,
      };
    }

    const { body, description } = parseSkill(content, skill);
    const referenceNames = canonicalFiles
      .map(relativeCandidatePath => canonicalSkillPath(relativeCandidatePath))
      .filter(candidate => candidate.skill === skill && candidate.filename !== 'SKILL.md')
      .map(candidate => candidate.filename);

    return {
      relativePath: nodePath.join('skills', skill, 'SKILL.md'),
      content: `---\n${stringify({ name: skill, description }).trimEnd()}\n---\n\n${adaptSkillBody(
        body,
        skillNames,
        referenceNames,
      )}`,
    };
  });
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
