import { readdirSync } from 'node:fs';
import nodePath from 'node:path';

import {
  adaptNativeRuntimeInvocations,
  generateCodexPluginAssets,
} from '../codex-plugin/catalogue.js';
import { CURSOR_COMMAND_WRAPPERS, type CursorCommandWrapper } from '../cursor-wrappers.js';
import { VERSION } from '../version.js';

export interface SafewordSubagent {
  readonly name: string;
  readonly description: string;
  readonly skill: string;
}

export const SAFEWORD_SUBAGENTS: readonly SafewordSubagent[] = [
  {
    name: 'safeword-reviewer',
    description: 'Run the fresh-context degraded Safeword review procedure.',
    skill: 'finish-review',
  },
  {
    name: 'safeword-retro-filer',
    description: 'File validated Safeword retrospective drafts through the guarded procedure.',
    skill: 'retro-filer',
  },
] as const;

function skillName(command: CursorCommandWrapper): string {
  const [name] = command.skillPath.split('/', 1);
  if (name === undefined) throw new Error(`OpenCode command ${command.name} has no skill path`);
  return name;
}

export function validateOpenCodeCatalogueReferences(
  knownSkills: ReadonlySet<string>,
  commands: readonly CursorCommandWrapper[],
  agents: readonly SafewordSubagent[],
): void {
  for (const reference of [
    ...commands.map(command => skillName(command)),
    ...agents.map(agent => agent.skill),
  ]) {
    if (!knownSkills.has(reference)) {
      throw new Error(`OpenCode catalogue references unknown skill: ${reference}`);
    }
  }
}

export function renderOpenCodeCommand(command: CursorCommandWrapper): string {
  return `---
description: ${JSON.stringify(command.description)}
---

Load and follow the \`safeword-${skillName(command)}\` skill completely. Pass \`$ARGUMENTS\` as the user's arguments.
`;
}

export function renderOpenCodeAgent(agent: SafewordSubagent): string {
  return `---
description: ${JSON.stringify(agent.description)}
mode: subagent
---

Load and follow the \`safeword-${agent.skill}\` skill completely.
`;
}

export interface OpenCodeCatalogueAsset {
  readonly relativePath: string;
  readonly content: string;
}

function renderOpenCodeSkill(name: string, content: string, skillEntry: boolean): string {
  if (!skillEntry) return content.replaceAll(`$safeword:${name}`, () => `/safeword-${name}`);
  const expected = `name: ${name}`;
  const nameFields = content
    .matchAll(/^name: [a-z][a-z0-9-]*$/gmu)
    .map(match => match[0])
    .toArray();
  if (nameFields.length !== 1 || nameFields[0] !== expected) {
    throw new Error(`Generated OpenCode skill ${name} has an invalid name field`);
  }
  const renamed = content.replace(/^name: [a-z][a-z0-9-]*$/mu, () => `name: safeword-${name}`);
  return renamed.replaceAll(`$safeword:${name}`, () => `/safeword-${name}`);
}

export function generateOpenCodeCatalogueAssets(
  templatesRoot: string,
): readonly OpenCodeCatalogueAsset[] {
  const skillsRoot = nodePath.join(templatesRoot, 'skills');
  const skillNames = readdirSync(skillsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  const knownSkills = new Set(skillNames);
  validateOpenCodeCatalogueReferences(knownSkills, CURSOR_COMMAND_WRAPPERS, SAFEWORD_SUBAGENTS);
  const skills = generateCodexPluginAssets(skillsRoot, VERSION).map(asset => {
    const [, name, ...suffix] = asset.relativePath.split(nodePath.sep);
    if (name === undefined || !knownSkills.has(name)) {
      throw new Error(`Generated native skill has an unexpected path: ${asset.relativePath}`);
    }
    let content = adaptNativeRuntimeInvocations(asset.content, VERSION);
    const skillEntry = nodePath.basename(asset.relativePath) === 'SKILL.md';
    for (const skill of skillNames) content = renderOpenCodeSkill(skill, content, false);
    if (skillEntry) content = renderOpenCodeSkill(name, content, true);
    return {
      relativePath: nodePath.join('skills', `safeword-${name}`, ...suffix),
      content,
    };
  });
  const commands = CURSOR_COMMAND_WRAPPERS.map(command => ({
    relativePath: nodePath.join('commands', `safeword-${command.name}.md`),
    content: renderOpenCodeCommand(command),
  }));
  const agents = SAFEWORD_SUBAGENTS.map(agent => ({
    relativePath: nodePath.join('agents', `${agent.name}.md`),
    content: renderOpenCodeAgent(agent),
  }));
  return [...skills, ...commands, ...agents].toSorted((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
}
