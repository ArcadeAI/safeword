import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

declare const Bun: { stdin: { json(): Promise<unknown> } };

// Packaged dependency closure: .safeword/guides/
// Packaged dependency closure (already in packaged form; SAFEWORD.md is a
// single file, not a directory, so it skips the generic rewrite above):
// "${CLAUDE_PLUGIN_ROOT}"/resources/SAFEWORD.md

export type Agent = 'claude' | 'codex' | 'cursor';
export type HookInput = {
  cwd?: string;
  session_id?: string;
  workspace_root?: string;
};

const CODEX_AUTHORITY = [
  'Current Safeword authority: tickets and their user stories/test definitions live under `.project/` (or the configured namespace root), and the applicable Safeword guides provide the current workflows.',
  'These current paths supersede retired Safeword instructions that require `planning/` or `docs/` story/test-definition trees or `~/.agents/coding/guides/`.',
].join('\n');

// Session-start hooks run repeatedly and their output has a small host-controlled
// context budget. Keep this durable pointer compact; the handbook stays the source
// of truth and is read when an agent begins non-trivial work.
function sessionBootstrap(handbook: string, guides: string): string {
  return [
    'Safeword session bootstrap:',
    `Before non-trivial work, read ${handbook} and the applicable guide in ${guides}.`,
    'Current tickets, learnings, and project context are under `.project/` (or the configured namespace root).',
    'Follow the active Safeword workflow and its gates.',
  ].join('\n');
}

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
  const packagedPath =
    packagedContextPath && existsSync(packagedContextPath) ? packagedContextPath : undefined;
  const safewordPath = packagedPath ?? nodePath.join(projectDir, '.safeword/SAFEWORD.md');
  if (!existsSync(safewordPath)) return null;

  // Read and validate the selected authority path (which may be the packaged
  // plugin handbook), but never inject its full contents into a bounded hook
  // context. This preserves the packaged-context boundary for native Codex.
  if (!readFileSync(safewordPath, 'utf8').trim()) return null;

  return sessionBootstrap(
    packagedPath ? 'the packaged Safeword handbook' : '`.safeword/SAFEWORD.md`',
    packagedPath ? 'the packaged Safeword guides' : `\`${['.safeword', 'guides'].join('/')}/\``,
  );
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
