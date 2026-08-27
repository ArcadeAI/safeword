import { CURSOR_COMMAND_WRAPPERS, type CursorCommandWrapper } from '../cursor-wrappers.js';

export interface SafewordSubagent {
  readonly name: string;
  readonly description: string;
  readonly procedurePath: string;
}

export const SAFEWORD_SUBAGENTS: readonly SafewordSubagent[] = [
  {
    name: 'safeword-reviewer',
    description: 'Run the fresh-context degraded Safeword review procedure.',
    procedurePath: '.claude/skills/finish-review/REVIEWER.md',
  },
  {
    name: 'safeword-retro-filer',
    description: 'File validated Safeword retrospective drafts through the guarded procedure.',
    procedurePath: '.claude/skills/retro-filer/SKILL.md',
  },
] as const;

function skillName(command: CursorCommandWrapper): string {
  return command.skillPath.split('/', 1)[0] ?? command.name;
}

export function renderOpenCodeCommand(command: CursorCommandWrapper): string {
  return `---
description: ${JSON.stringify(command.description)}
---

Load and follow the \`${skillName(command)}\` skill completely. Pass \`$ARGUMENTS\` as the user's arguments.
`;
}

export function renderOpenCodeAgent(agent: SafewordSubagent): string {
  return `---
description: ${JSON.stringify(agent.description)}
mode: subagent
---

Read and follow \`${agent.procedurePath}\` completely.
`;
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
