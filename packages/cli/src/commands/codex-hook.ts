import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { resolveNamespaceRoot } from '../utils/configured-paths.js';

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
const CODEX_RUN_IDENTITY_CACHE = 'codex-run-identity.json';
const SHELL_OPERATORS = new Set([';', '&&', '||', '|']);
const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
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

function resolveProjectDirectory(): string {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;

  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
    if (root.length > 0) return root;
  } catch {
    // Fall back to cwd when the hook runs outside git or git is unavailable.
  }

  return process.cwd();
}

function tokenizeShellCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let escaped = false;

  function flush(): void {
    if (current.length > 0) {
      tokens.push(current);
      current = '';
    }
  }

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (char === undefined) continue;

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/u.test(char)) {
      flush();
      continue;
    }

    if (char === '&' && command[index + 1] === '&') {
      flush();
      tokens.push('&&');
      index += 1;
      continue;
    }

    if (char === '|' && command[index + 1] === '|') {
      flush();
      tokens.push('||');
      index += 1;
      continue;
    }

    if (char === ';' || char === '|') {
      flush();
      tokens.push(char);
      continue;
    }

    current += char;
  }

  flush();
  return tokens;
}

function shellSegments(command: string): string[][] {
  const tokens = tokenizeShellCommand(command);
  const segments: string[][] = [];
  let start = 0;

  for (let index = 0; index <= tokens.length; index += 1) {
    if (index !== tokens.length && !SHELL_OPERATORS.has(tokens[index] ?? '')) continue;
    segments.push(tokens.slice(start, index));
    start = index + 1;
  }

  return segments;
}

function executableIndexOf(segment: string[]): number {
  let executableIndex = 0;
  while (/^[A-Za-z_][A-Za-z0-9_]*=/u.test(segment[executableIndex] ?? '')) {
    executableIndex += 1;
  }
  return executableIndex;
}

function parseRecordSkillInvocationCommand(command: string): string | undefined {
  for (const segment of shellSegments(command)) {
    const executableIndex = executableIndexOf(segment);
    const executable = segment[executableIndex];
    const helperPath = segment[executableIndex + 1]?.replaceAll('\\', '/');
    const skillName = segment[executableIndex + 3]?.trim();

    if (nodePath.basename(executable ?? '') !== 'bun') continue;
    if (!helperPath?.endsWith('/.safeword/hooks/record-skill-invocation.ts')) continue;
    if (skillName && SKILL_NAME_PATTERN.test(skillName)) return skillName;
  }

  return undefined;
}

function rememberCodexRunIdentity(input: {
  projectDirectory: string;
  sessionId: string | undefined;
  skillName: string | undefined;
}): void {
  const sessionId = input.sessionId?.trim();
  const skillName = input.skillName?.trim();
  if (!sessionId || !skillName) return;

  try {
    const cachePath = nodePath.join(
      resolveNamespaceRoot(input.projectDirectory),
      CODEX_RUN_IDENTITY_CACHE,
    );
    mkdirSync(nodePath.dirname(cachePath), { recursive: true });
    writeFileSync(
      cachePath,
      JSON.stringify({ id: sessionId, skillName, recordedAt: new Date().toISOString() }),
      'utf8',
    );
  } catch {
    // This bridge only enables done-gate proof. It must never block a tool call.
  }
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

  const projectDirectory = resolveProjectDirectory();
  rememberCodexRunIdentity({
    projectDirectory,
    sessionId: input.session_id,
    skillName: parseRecordSkillInvocationCommand(input.tool_input?.command ?? ''),
  });

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

  const projectDirectory = resolveProjectDirectory();
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

  const projectDirectory = resolveProjectDirectory();
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
