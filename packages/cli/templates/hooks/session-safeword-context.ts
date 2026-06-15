#!/usr/bin/env bun
// Safeword: inject standing SAFEWORD.md instructions at session start.

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

type Agent = 'claude' | 'codex' | 'cursor';
type HookInput = {
  cwd?: string;
  workspace_root?: string;
};

function parseAgent(): Agent {
  const argument = process.argv.find(value => value.startsWith('--agent='));
  const value = argument?.slice('--agent='.length);
  if (value === 'cursor' || value === 'codex' || value === 'claude') return value;
  return 'claude';
}

async function readHookInput(): Promise<HookInput> {
  try {
    return (await Bun.stdin.json()) as HookInput;
  } catch {
    return {};
  }
}

function findProjectDir(candidate: string): string | null {
  let current = nodePath.resolve(candidate);
  while (true) {
    if (existsSync(nodePath.join(current, '.safeword/SAFEWORD.md'))) return current;

    const parent = nodePath.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function resolveProjectDir(input: HookInput): string {
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

function readSafewordContext(projectDir: string): string | null {
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

const agent = parseAgent();
const hookInput = await readHookInput();
const context = readSafewordContext(resolveProjectDir(hookInput));

if (!context) {
  process.exit(0);
}

if (agent === 'cursor') {
  process.stdout.write(`${JSON.stringify({ additional_context: context })}\n`);
} else {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: context,
      },
    })}\n`,
  );
}
