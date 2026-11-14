import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { hasSafewordProjectMarker } from './namespace-root.ts';

declare const Bun: { stdin: { json(): Promise<unknown> } };

// Packaged dependency closure: .safeword/guides/
// Packaged dependency closure (already in packaged form; SAFEWORD.md is a
// single file, not a directory, so it skips the generic rewrite above):
// "${CLAUDE_PLUGIN_ROOT}"/resources/SAFEWORD.md

export type Agent = 'claude' | 'codex' | 'cursor';
export type HookInput = {
  cwd?: string;
  session_id?: string;
  source?: string;
  workspace_root?: string;
};

const CODEX_AUTHORITY = [
  'Current Safeword authority: tickets and their user stories/test definitions live under `.project/` (or the configured namespace root), and the applicable Safeword guides provide the current workflows.',
  'These current paths supersede retired Safeword instructions that require `planning/` or `docs/` story/test-definition trees or `~/.agents/coding/guides/`.',
].join('\n');

// Host hook context is capped (Claude Code: 10,000 characters) and the handbook is
// larger, so inject an instruction to read it rather than its contents. Keep it one
// unconditional line with an absolute path. In headless Claude Code evals with the full
// plugin loaded (Opus and Sonnet), this line made a full handbook read the first tool
// call in 24/24 trials, including after compaction. The conditional "before non-trivial
// work" pointer scored 0/24, and a bare "First, Read <path> in full." was skipped after
// compaction (1/6) because the summary looks like the read already happened.
export function sessionBootstrap(handbookPath: string): string {
  return `First, Read \`${handbookPath}\` in full, even for trivial requests or right after compaction; a summary or earlier read does not count.`;
}

// A resumed session still holds the earlier read; startup, clear and compact do not.
export function needsSafewordContext(input: HookInput): boolean {
  return input.source !== 'resume';
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
    if (hasSafewordProjectMarker(current)) return current;

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

/**
 * A plugin runtime named its packaged handbook, but the file is missing or empty.
 * Plugin installs never fall back to a project copy: agents follow the bootstrap
 * line faithfully, so a stale `.safeword` handbook would silently become authority.
 */
export class MissingPackagedHandbookError extends Error {
  constructor(readonly packagedPath: string) {
    super(
      `Safeword's plugin is missing its packaged handbook at ${packagedPath}. Reinstall or update the Safeword plugin; Safeword does not fall back to a project copy.`,
    );
    this.name = 'MissingPackagedHandbookError';
  }
}

function hasHandbookContent(path: string): boolean {
  return existsSync(path) && readFileSync(path, 'utf8').trim() !== '';
}

/**
 * Plugin runtimes (the Claude dispatcher and the Codex hook bridge) always set
 * SAFEWORD_PACKAGED_CONTEXT_PATH; only legacy project-hook installs leave it
 * unset and read the project's own handbook.
 */
export function readSafewordContext(projectDir: string): string | null {
  const packagedPath = process.env.SAFEWORD_PACKAGED_CONTEXT_PATH;
  // Read and validate the selected authority path, but never inject its full
  // contents into a bounded hook context.
  if (packagedPath) {
    if (!hasHandbookContent(packagedPath)) throw new MissingPackagedHandbookError(packagedPath);
    return sessionBootstrap(nodePath.resolve(packagedPath));
  }

  const projectPath = nodePath.join(projectDir, '.safeword/SAFEWORD.md');
  if (!hasHandbookContent(projectPath)) return null;
  return sessionBootstrap(nodePath.resolve(projectPath));
}

/** Report a missing packaged handbook as a visible hook failure; rethrow anything else. */
export function reportMissingPackagedHandbook(error: unknown): number {
  if (!(error instanceof MissingPackagedHandbookError)) throw error;
  process.stderr.write(`${error.message}\n`);
  return 1;
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
