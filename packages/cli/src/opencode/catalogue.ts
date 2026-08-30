import { readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { generateCodexPluginAssets } from '../codex-plugin/catalogue.js';
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
  return command.skillPath.split('/', 1)[0] ?? command.name;
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
  const renamed = skillEntry
    ? content.replace(/^name: [a-z-]+$/mu, line =>
        line === `name: ${name}` ? `name: safeword-${name}` : line,
      )
    : content;
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
  const skills = generateCodexPluginAssets(skillsRoot, VERSION).map(asset => {
    const [, name, ...suffix] = asset.relativePath.split(nodePath.sep);
    if (name === undefined || !knownSkills.has(name)) {
      throw new Error(`Generated native skill has an unexpected path: ${asset.relativePath}`);
    }
    let content = asset.content;
    const skillEntry = nodePath.basename(asset.relativePath) === 'SKILL.md';
    for (const skill of skillNames) content = renderOpenCodeSkill(skill, content, skillEntry);
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

export const OPENCODE_CATALOGUE_OWNED_FILES = Object.fromEntries([
  ...CURSOR_COMMAND_WRAPPERS.map(
    command =>
      [
        `.opencode/commands/${command.name}.md`,
        { content: (): string => renderOpenCodeCommand(command) },
      ] as const,
  ),
  ...SAFEWORD_SUBAGENTS.map(
    agent =>
      [
        `.opencode/agents/${agent.name}.md`,
        { content: (): string => renderOpenCodeAgent(agent) },
      ] as const,
  ),
]);
