import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

export type Agent = 'claude' | 'codex' | 'cursor';
export type HookInput = {
  cwd?: string;
  workspace_root?: string;
};

export function parseAgent(args: readonly string[] = process.argv): Agent {
  const argument = args.find(value => value.startsWith('--agent='));
  const value = argument?.slice('--agent='.length);
  if (value === 'cursor' || value === 'codex' || value === 'claude') return value;
  return 'claude';
}

export async function readHookInput(): Promise<HookInput> {
  try {
    return (await Bun.stdin.json()) as HookInput;
  } catch {
    return {};
  }
}

export function findProjectDir(candidate: string): string | null {
  let current = nodePath.resolve(candidate);
  while (true) {
    if (existsSync(nodePath.join(current, '.safeword/SAFEWORD.md'))) return current;

    const parent = nodePath.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function resolveProjectDir(input: HookInput): string {
  const candidates = [
    process.env.CLAUDE_PROJECT_DIR,
    input.workspace_root,
    input.cwd,
    process.cwd(),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const projectDir = findProjectDir(candidate);
    if (projectDir) return projectDir;
  }

  return process.cwd();
}

export function readSafewordContext(projectDir: string): string | null {
  const safewordPath = nodePath.join(projectDir, '.safeword/SAFEWORD.md');
  if (!existsSync(safewordPath)) return null;

  const content = readFileSync(safewordPath, 'utf8').trim();
  if (!content) return null;

  return [
    'SAFEWORD.md standing instructions are loaded by safeword-owned hooks.',
    'Follow these instructions for this session:',
    '',
    content,
  ].join('\n');
}

export function createSafewordContextResponse(
  agent: Agent,
  context: string | null,
): string | undefined {
  if (!context) return undefined;

  if (agent === 'cursor') {
    return `${JSON.stringify({ additional_context: context })}\n`;
  }

  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  })}\n`;
}
