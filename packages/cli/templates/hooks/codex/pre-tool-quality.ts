#!/usr/bin/env bun
// Safeword: Codex PreToolUse adapter for the existing quality gate.
//
// This spike keeps pre-tool-quality.ts as the source of truth and translates
// supported Codex edit payloads into the Claude-shaped hook input it already
// understands.

import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

interface CodexHookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: {
    command?: string;
    file_path?: string;
    notebook_path?: string;
    old_string?: string;
    new_string?: string;
    content?: string;
    edits?: Array<{ old_string?: string; new_string?: string }>;
  };
}

interface ClaudeHookInput {
  session_id?: string;
  hook_event_name: 'PreToolUse';
  tool_name: 'Bash' | 'Edit' | 'Write' | 'MultiEdit' | 'NotebookEdit';
  tool_input: NonNullable<CodexHookInput['tool_input']>;
}

interface PatchTarget {
  filePath: string;
  toolName: 'Edit' | 'Write';
  content?: string;
}

const DIRECT_TOOLS = new Set(['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const EXIT_CODE_DENY_MODE = 'exit-code';

async function readInput(): Promise<CodexHookInput | undefined> {
  try {
    return JSON.parse(await Bun.stdin.text()) as CodexHookInput;
  } catch {
    return undefined;
  }
}

function extractFirstPatchTarget(command: string): PatchTarget | undefined {
  const lines = command.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const match = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line.trim());
    if (!match) continue;

    const operation = match[1];
    const filePath = match[2]?.trim();
    if (!filePath) return undefined;

    if (operation === 'Add') {
      return {
        filePath,
        toolName: 'Write',
        content: extractAddedFileContent(lines.slice(index + 1)),
      };
    }

    return { filePath, toolName: 'Edit' };
  }

  return undefined;
}

function extractAddedFileContent(linesAfterHeader: string[]): string {
  const contentLines: string[] = [];
  for (const line of linesAfterHeader) {
    if (line.startsWith('*** ')) break;
    if (line.startsWith('+')) {
      contentLines.push(line.slice(1));
    }
  }
  return contentLines.join('\n');
}

function translateInput(input: CodexHookInput): ClaudeHookInput | undefined {
  const toolName = input.tool_name ?? '';

  if (DIRECT_TOOLS.has(toolName)) {
    return {
      session_id: input.session_id,
      hook_event_name: 'PreToolUse',
      tool_name: toolName as ClaudeHookInput['tool_name'],
      tool_input: input.tool_input ?? {},
    };
  }

  if (toolName !== 'apply_patch') return undefined;

  const patchTarget = extractFirstPatchTarget(input.tool_input?.command ?? '');
  if (!patchTarget) return undefined;

  return {
    session_id: input.session_id,
    hook_event_name: 'PreToolUse',
    tool_name: patchTarget.toolName,
    tool_input: {
      file_path: patchTarget.filePath,
      ...(patchTarget.content === undefined ? {} : { content: patchTarget.content }),
    },
  };
}

function denialReasonFrom(stdout: string): string | undefined {
  if (stdout.trim() === '') return undefined;

  try {
    const parsed = JSON.parse(stdout) as {
      hookSpecificOutput?: {
        permissionDecision?: unknown;
        permissionDecisionReason?: unknown;
      };
    };
    if (parsed.hookSpecificOutput?.permissionDecision !== 'deny') return undefined;

    const reason = parsed.hookSpecificOutput.permissionDecisionReason;
    return typeof reason === 'string' ? reason : 'Safeword denied this action.';
  } catch {
    return undefined;
  }
}

const input = await readInput();
if (!input) process.exit(0);

const translated = translateInput(input);
if (!translated) process.exit(0);

const hookDirectory = nodePath.dirname(fileURLToPath(import.meta.url));
const claudeHookPath = nodePath.join(hookDirectory, '..', 'pre-tool-quality.ts');
const result = spawnSync('bun', [claudeHookPath], {
  cwd: process.cwd(),
  input: JSON.stringify(translated),
  encoding: 'utf8',
  env: {
    ...process.env,
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

const stdout = result.stdout ?? '';
const stderr = result.stderr ?? '';
const reason = denialReasonFrom(stdout);

if (process.env.SAFEWORD_CODEX_DENY_MODE === EXIT_CODE_DENY_MODE && reason !== undefined) {
  console.error(reason);
  process.exit(2);
}

if (stdout !== '') process.stdout.write(stdout);
if (stderr !== '') process.stderr.write(stderr);
process.exit(result.status ?? 0);
