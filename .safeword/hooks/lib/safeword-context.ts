import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

declare const Bun: { stdin: { json(): Promise<unknown> } };

export type Agent = 'claude' | 'codex' | 'cursor';
export type HookInput = {
  cwd?: string;
  workspace_root?: string;
};

const CODEX_AUTHORITY = [
  'Current Safe Word authority: tickets and their user stories/test definitions live under `.project/` (or the configured namespace root), and current workflow guides live under `.safeword/guides/`.',
  'These current paths supersede retired Safe Word instructions that require `planning/` or `docs/` story/test-definition trees or `~/.agents/coding/guides/`.',
].join('\n');

export function withCodexAuthority(context: string | null): string | null {
  return context === null ? null : `${CODEX_AUTHORITY}\n\n${context}`;
}

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
  const packagedContextPath = process.env.SAFEWORD_PACKAGED_CONTEXT_PATH;
  const safewordPath =
    packagedContextPath && existsSync(packagedContextPath)
      ? packagedContextPath
      : nodePath.join(projectDir, '.safeword/SAFEWORD.md');
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
  const agentContext = agent === 'codex' ? withCodexAuthority(context) : context;

  if (agent === 'cursor') {
    return `${JSON.stringify({ additional_context: agentContext })}\n`;
  }

  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: agentContext,
    },
  })}\n`;
}
