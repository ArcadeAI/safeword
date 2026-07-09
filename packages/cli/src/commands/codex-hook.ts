import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

type SupportedCodexHookEvent = 'pre-tool-use';

interface CodexHookInput {
  hook_event_name?: string;
  session_id?: string;
  tool_name?: string;
  tool_input?: {
    command?: string;
    file_path?: string;
    notebook_path?: string;
  };
}

interface DenialOutput {
  systemMessage: string;
  hookSpecificOutput: {
    hookEventName: 'PreToolUse';
    permissionDecision: 'deny';
    permissionDecisionReason: string;
  };
}

const EXPLAIN_HINT = 'Run `safeword:explain` for a plain-English version of this block.';
const REQUIRED_INTAKE_FIELDS = ['scope', 'out_of_scope', 'done_when'] as const;

async function readStdin(): Promise<string> {
  let body = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    body += String(chunk);
  }
  return body;
}

function parseCodexHookInput(raw: string): CodexHookInput | undefined {
  try {
    return JSON.parse(raw) as CodexHookInput;
  } catch {
    return undefined;
  }
}

function normalizeEvent(event: string): SupportedCodexHookEvent | undefined {
  return event === 'pre-tool-use' ? event : undefined;
}

function extractPatchTargets(command: string): string[] {
  const targets: string[] = [];
  for (const line of command.split(/\r?\n/)) {
    const match = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/.exec(line.trim());
    if (match?.[1]) targets.push(match[1].trim());
  }
  return targets;
}

function extractTargetPaths(input: CodexHookInput): string[] {
  if (input.tool_name === 'apply_patch') {
    return extractPatchTargets(input.tool_input?.command ?? '');
  }

  const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  return filePath ? [filePath] : [];
}

function frontmatterBody(content: string): string | undefined {
  const normalized = content.replaceAll('\r\n', '\n');
  if (!normalized.startsWith('---\n')) return undefined;
  const end = normalized.indexOf('\n---', 4);
  return end === -1 ? undefined : normalized.slice(4, end);
}

function frontmatterHasField(body: string, field: string): boolean {
  const lines = body.split('\n');
  const fieldPrefix = `${field}:`;

  for (const [index, line] of lines.entries()) {
    if (!line.startsWith(fieldPrefix)) continue;

    const afterColon = line.slice(fieldPrefix.length).trim();
    if (afterColon.length > 0) return true;

    return lines.slice(index + 1).some(nextLine => /^\s+-\s*\S/u.test(nextLine));
  }

  return false;
}

function missingIntakeFields(ticketContent: string): string[] {
  const body = frontmatterBody(ticketContent);
  if (body === undefined) return [...REQUIRED_INTAKE_FIELDS];
  return REQUIRED_INTAKE_FIELDS.filter(field => !frontmatterHasField(body, field));
}

function testDefinitionsTicketFolder(targetPath: string): string | undefined {
  const normalized = targetPath.replaceAll('\\', '/');
  const match = /^\.project\/tickets\/([^/]+)\/test-definitions\.md$/u.exec(normalized);
  return match?.[1];
}

function buildDenyOutput(reason: string): DenialOutput {
  return {
    systemMessage: EXPLAIN_HINT,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `${reason}\n\n${EXPLAIN_HINT}`,
    },
  };
}

function deny(reason: string): void {
  process.stdout.write(`${JSON.stringify(buildDenyOutput(reason))}\n`);
}

function maybeDenyTestDefinitionsWrite(projectDirectory: string, targetPath: string): boolean {
  const ticketFolder = testDefinitionsTicketFolder(targetPath);
  if (!ticketFolder) return false;

  const ticketPath = nodePath.join(projectDirectory, '.project/tickets', ticketFolder, 'ticket.md');
  const ticketContent = existsSync(ticketPath) ? readFileSync(ticketPath, 'utf8') : '';
  const missing = missingIntakeFields(ticketContent);
  if (missing.length === 0) return false;

  deny(
    `Cannot create test-definitions.md for ${ticketFolder} until ticket.md declares ${missing.join(
      ', ',
    )}.`,
  );
  return true;
}

async function runPreToolUse(): Promise<void> {
  const input = parseCodexHookInput(await readStdin());
  if (!input) return;

  const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  for (const targetPath of extractTargetPaths(input)) {
    if (maybeDenyTestDefinitionsWrite(projectDirectory, targetPath)) return;
  }
}

export async function codexHook(event: string): Promise<void> {
  const normalized = normalizeEvent(event);
  if (normalized === undefined) return;
  if (normalized === 'pre-tool-use') await runPreToolUse();
}
