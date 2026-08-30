import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { CURSOR_COMMAND_WRAPPERS, type CursorCommandWrapper } from '../cursor-wrappers.js';

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

function renderOpenCodeSkill(name: string, content: string): string {
  const lines = content.split('\n');
  const frontmatterEnd = lines.indexOf('---', 1);
  const nameIndex = lines.findIndex(
    (line, index) => index > 0 && index < frontmatterEnd && line.startsWith('name:'),
  );
  if (frontmatterEnd === -1 || nameIndex === -1) {
    throw new Error(`Canonical skill ${name} has no frontmatter name.`);
  }
  lines[nameIndex] = `name: safeword-${name}`;
  return lines.join('\n');
}

export function generateOpenCodeCatalogueAssets(
  templatesRoot: string,
): readonly OpenCodeCatalogueAsset[] {
  const skillsRoot = nodePath.join(templatesRoot, 'skills');
  const skills = readdirSync(skillsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      relativePath: nodePath.join('skills', `safeword-${entry.name}`, 'SKILL.md'),
      content: renderOpenCodeSkill(
        entry.name,
        readFileSync(nodePath.join(skillsRoot, entry.name, 'SKILL.md'), 'utf8'),
      ),
    }));
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
