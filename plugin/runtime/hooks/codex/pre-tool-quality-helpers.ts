import { spawnSync } from 'node:child_process';
import process from 'node:process';

export interface CodexHookInput {
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

export interface ClaudeHookInput {
  session_id?: string;
  hook_event_name: 'PreToolUse';
  tool_name: 'Bash' | 'Edit' | 'Write' | 'MultiEdit' | 'NotebookEdit';
  tool_input: NonNullable<CodexHookInput['tool_input']>;
}

/**
 * Spawn a Claude source-of-truth hook with a translated Codex input — shared by
 * all three Codex adapters. `CLAUDE_PROJECT_DIR` is set for the hook's path
 * resolution; `SAFEWORD_AGENT_RUNTIME` is the authoritative agent attribution
 * for the spawned hook (it runs under Codex, not Claude — this same var is what
 * self-report's detectAgent reads and what scopes the per-session state key).
 */
export function runClaudeHookAsCodex(claudeHookPath: string, translated: ClaudeHookInput) {
  return spawnSync('bun', [claudeHookPath], {
    cwd: process.cwd(),
    input: JSON.stringify(translated),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
      SAFEWORD_AGENT_RUNTIME: 'codex',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

interface PatchTarget {
  filePath: string;
  toolName: 'Edit' | 'Write';
  content?: string;
}

const DIRECT_TOOLS = new Set(['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

export function translateCodexInputToClaudeInputs(input: CodexHookInput): ClaudeHookInput[] {
  const toolName = input.tool_name ?? '';

  if (DIRECT_TOOLS.has(toolName)) {
    return [
      {
        session_id: input.session_id,
        hook_event_name: 'PreToolUse',
        tool_name: toolName as ClaudeHookInput['tool_name'],
        tool_input: input.tool_input ?? {},
      },
    ];
  }

  if (toolName !== 'apply_patch') return [];

  return extractPatchTargets(input.tool_input?.command ?? '').map(patchTarget => ({
    session_id: input.session_id,
    hook_event_name: 'PreToolUse',
    tool_name: patchTarget.toolName,
    tool_input: {
      file_path: patchTarget.filePath,
      ...(patchTarget.content === undefined ? {} : { content: patchTarget.content }),
    },
  }));
}

export function denialReasonFromHookOutput(stdout: string): string | undefined {
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

function extractPatchTargets(command: string): PatchTarget[] {
  const lines = command.split(/\r?\n/);
  const targets: PatchTarget[] = [];

  for (const [index, line] of lines.entries()) {
    const match = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line.trim());
    if (!match) continue;

    const operation = match[1];
    const filePath = match[2]?.trim();
    if (!filePath) continue;

    if (operation === 'Add') {
      targets.push({
        filePath,
        toolName: 'Write',
        content: extractAddedFileContent(lines.slice(index + 1)),
      });
      continue;
    }

    targets.push({ filePath, toolName: 'Edit' });
  }

  return targets;
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
