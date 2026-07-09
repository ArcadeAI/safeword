import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

type AdditionalContextHookEvent = 'PostToolUse' | 'SessionStart' | 'UserPromptSubmit';
type SupportedCodexHookEvent =
  'post-tool-use' | 'pre-tool-use' | 'session-start' | 'stop' | 'user-prompt-submit';

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

interface AdditionalContextOutput {
  hookSpecificOutput: {
    hookEventName: AdditionalContextHookEvent;
    additionalContext: string;
  };
}

interface StopContinuationOutput {
  decision: 'block';
  reason: string;
}

const EXPLAIN_HINT = 'Run `safeword:explain` for a plain-English version of this block.';
const REQUIRED_INTAKE_FIELDS = ['scope', 'out_of_scope', 'done_when'] as const;
const MODULE_DIRECTORY = import.meta.dirname;
const SAFEWORD_INSTRUCTIONS_PATHS = [
  nodePath.resolve(MODULE_DIRECTORY, '../templates/SAFEWORD.md'),
  nodePath.resolve(MODULE_DIRECTORY, '../../templates/SAFEWORD.md'),
];
const POST_TOOL_GUIDANCE_PATH = '.project/codex-post-tool-guidance.txt';
const PROMPT_CONTEXT_PATH = '.project/codex-prompt-context.txt';
const STOP_CONTINUATION_PATH = '.project/codex-stop-continuation.txt';
const SUPPORTED_CODEX_HOOK_EVENTS: ReadonlySet<string> = new Set([
  'post-tool-use',
  'pre-tool-use',
  'session-start',
  'stop',
  'user-prompt-submit',
]);

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
  if (SUPPORTED_CODEX_HOOK_EVENTS.has(event)) return event as SupportedCodexHookEvent;
  return undefined;
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

function readPackagedSafewordInstructions(): string | undefined {
  const instructionsPath = SAFEWORD_INSTRUCTIONS_PATHS.find(candidate => existsSync(candidate));
  return instructionsPath ? readFileSync(instructionsPath, 'utf8') : undefined;
}

function readProjectTextFile(projectDirectory: string, relativePath: string): string | undefined {
  const filePath = nodePath.join(projectDirectory, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : undefined;
}

function emitAdditionalContext(output: AdditionalContextOutput): void {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function emitStopNoop(): void {
  process.stdout.write('{}\n');
}

function emitStopContinuation(output: StopContinuationOutput): void {
  process.stdout.write(`${JSON.stringify(output)}\n`);
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

async function runSessionStart(): Promise<void> {
  const input = parseCodexHookInput(await readStdin());
  if (!input) return;

  const additionalContext = readPackagedSafewordInstructions();
  if (!additionalContext) return;

  emitAdditionalContext({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext,
    },
  });
}

async function runProjectAdditionalContext(
  hookEventName: AdditionalContextHookEvent,
  relativePath: string,
): Promise<void> {
  const input = parseCodexHookInput(await readStdin());
  if (!input) return;

  const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const additionalContext = readProjectTextFile(projectDirectory, relativePath)?.trim();
  if (!additionalContext) return;

  emitAdditionalContext({
    hookSpecificOutput: {
      hookEventName,
      additionalContext,
    },
  });
}

async function runPostToolUse(): Promise<void> {
  await runProjectAdditionalContext('PostToolUse', POST_TOOL_GUIDANCE_PATH);
}

async function runUserPromptSubmit(): Promise<void> {
  await runProjectAdditionalContext('UserPromptSubmit', PROMPT_CONTEXT_PATH);
}

async function runStop(): Promise<void> {
  const input = parseCodexHookInput(await readStdin());
  if (!input) {
    emitStopNoop();
    return;
  }

  const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const reason = readProjectTextFile(projectDirectory, STOP_CONTINUATION_PATH)?.trim();
  if (!reason) {
    emitStopNoop();
    return;
  }

  emitStopContinuation({ decision: 'block', reason });
}

const CODEX_HOOK_RUNNERS: Record<SupportedCodexHookEvent, () => Promise<void>> = {
  'post-tool-use': runPostToolUse,
  'pre-tool-use': runPreToolUse,
  'session-start': runSessionStart,
  stop: runStop,
  'user-prompt-submit': runUserPromptSubmit,
};

export async function codexHook(event: string): Promise<void> {
  const normalized = normalizeEvent(event);
  if (normalized === undefined) return;
  await CODEX_HOOK_RUNNERS[normalized]();
}
