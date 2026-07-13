import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { generateOwnedPathsModule } from '../owned-paths.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
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

const EXPLAIN_HINT = 'Run `$explain` for a plain-English version of this block.';
const EXIT_CODE_DENY_MODE = 'exit-code';
const REQUIRED_INTAKE_FIELDS = ['scope', 'out_of_scope', 'done_when'] as const;
const MODULE_DIRECTORY = import.meta.dirname;
const SAFEWORD_INSTRUCTIONS_PATHS = [
  nodePath.resolve(MODULE_DIRECTORY, '../templates/SAFEWORD.md'),
  nodePath.resolve(MODULE_DIRECTORY, '../../templates/SAFEWORD.md'),
];
const TEMPLATE_HOOKS_DIRECTORIES = [
  nodePath.resolve(MODULE_DIRECTORY, '../templates/hooks'),
  nodePath.resolve(MODULE_DIRECTORY, '../../templates/hooks'),
];
const POST_TOOL_GUIDANCE_PATH = '.project/codex-post-tool-guidance.txt';
const PROMPT_CONTEXT_PATH = '.project/codex-prompt-context.txt';
const STOP_CONTINUATION_PATH = '.project/codex-stop-continuation.txt';
const CODEX_RUN_IDENTITY_CACHE = 'codex-run-identity.json';
const CODEX_REVIEW_STAMP_IDENTITY_CACHE = 'codex-review-stamp-identity.json';
const RECORD_SKILL_INVOCATION_SCRIPT = '.safeword/hooks/record-skill-invocation.ts';
const WRITE_REVIEW_STAMP_SCRIPT = '.safeword/hooks/write-review-stamp.ts';
const REVIEW_STAMP_CACHE_KEY = 'review-stamp';
const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/u;
const SHELL_SEPARATORS = ';&|';
const SHELL_WHITESPACE = ' \n\r\t\v\f';
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

function isShellWhitespace(character: string | undefined): boolean {
  return character !== undefined && SHELL_WHITESPACE.includes(character);
}

function isShellSeparator(character: string | undefined): boolean {
  return character !== undefined && SHELL_SEPARATORS.includes(character);
}

function readShellArgument(
  command: string,
  startIndex: number,
): { value: string; nextIndex: number } | undefined {
  let index = startIndex;
  while (isShellWhitespace(command[index])) index += 1;

  const quote = command[index];
  if (quote === '"' || quote === "'") {
    const endIndex = command.indexOf(quote, index + 1);
    if (endIndex === -1) return undefined;
    return { value: command.slice(index + 1, endIndex), nextIndex: endIndex + 1 };
  }

  let endIndex = index;
  while (
    endIndex < command.length &&
    !isShellWhitespace(command[endIndex]) &&
    !isShellSeparator(command[endIndex])
  ) {
    endIndex += 1;
  }

  if (endIndex === index) return undefined;
  return { value: command.slice(index, endIndex), nextIndex: endIndex };
}

function parseRecordSkillInvocationCommand(command: string): string | undefined {
  const scriptIndex = command.indexOf(RECORD_SKILL_INVOCATION_SCRIPT);
  if (scriptIndex === -1) return undefined;

  let nextIndex = scriptIndex + RECORD_SKILL_INVOCATION_SCRIPT.length;
  const closingQuote = command[nextIndex];
  if (closingQuote === '"' || closingQuote === "'") nextIndex += 1;

  const projectArgument = readShellArgument(command, nextIndex);
  if (!projectArgument) return undefined;

  const skillArgument = readShellArgument(command, projectArgument.nextIndex);
  const skillName = skillArgument?.value;
  return skillName && SKILL_NAME_PATTERN.test(skillName) ? skillName : undefined;
}

function commandInvokesWriteReviewStamp(command: string): boolean {
  return command.replaceAll('\\', '/').includes(WRITE_REVIEW_STAMP_SCRIPT);
}

function writeCodexIdentityCache(input: {
  projectDirectory: string;
  cacheFile: string;
  sessionId: string | undefined;
  skillName: string | undefined;
}): void {
  const sessionId = input.sessionId?.trim();
  const skillName = input.skillName?.trim();
  if (!sessionId || !skillName) return;

  try {
    const cachePath = nodePath.join(resolveNamespaceRoot(input.projectDirectory), input.cacheFile);
    mkdirSync(nodePath.dirname(cachePath), { recursive: true });
    writeFileSync(
      cachePath,
      JSON.stringify({ id: sessionId, skillName, recordedAt: new Date().toISOString() }),
      'utf8',
    );
  } catch {
    // This bridge only enables proof helpers. It must never block a tool call.
  }
}

function rememberCodexRunIdentity(input: {
  projectDirectory: string;
  sessionId: string | undefined;
  skillName: string | undefined;
}): void {
  writeCodexIdentityCache({ ...input, cacheFile: CODEX_RUN_IDENTITY_CACHE });
}

function rememberCodexReviewStampIdentity(input: {
  projectDirectory: string;
  sessionId: string | undefined;
}): void {
  writeCodexIdentityCache({
    projectDirectory: input.projectDirectory,
    cacheFile: CODEX_REVIEW_STAMP_IDENTITY_CACHE,
    sessionId: input.sessionId,
    skillName: REVIEW_STAMP_CACHE_KEY,
  });
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
  const output = buildDenyOutput(reason);
  if (process.env.SAFEWORD_CODEX_DENY_MODE === EXIT_CODE_DENY_MODE) {
    process.stderr.write(`${output.hookSpecificOutput.permissionDecisionReason}\n`);
    process.exit(2);
  }

  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function readPackagedSafewordInstructions(): string | undefined {
  const instructionsPath = SAFEWORD_INSTRUCTIONS_PATHS.find(candidate => existsSync(candidate));
  return instructionsPath ? readFileSync(instructionsPath, 'utf8') : undefined;
}

function resolvePackagedHook(relativePath: string): string | undefined {
  return TEMPLATE_HOOKS_DIRECTORIES.map(directory => nodePath.join(directory, relativePath)).find(
    candidate => existsSync(candidate),
  );
}

function runPackagedHook(relativePath: string, rawInput: string, projectDirectory: string): string {
  const hookPath = resolvePackagedHook(relativePath);
  if (!hookPath) return '';

  let executableHookPath = hookPath;
  let temporaryHookDirectory: string | undefined;
  if (relativePath === 'session-codex-start.ts') {
    // The installed dispatcher imports a project-generated ownership list. Build
    // that one generated dependency in a temporary package copy for CLI delivery.
    temporaryHookDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    cpSync(nodePath.dirname(hookPath), temporaryHookDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(temporaryHookDirectory, 'lib', 'owned-paths.ts'),
      generateOwnedPathsModule(SAFEWORD_SCHEMA),
      'utf8',
    );
    executableHookPath = nodePath.join(temporaryHookDirectory, nodePath.basename(hookPath));
  }

  try {
    const result = spawnSync('bun', [executableHookPath], {
      cwd: projectDirectory,
      input: rawInput,
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectDirectory,
        SAFEWORD_AGENT_RUNTIME: 'codex',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return result.stdout ?? '';
  } finally {
    if (temporaryHookDirectory) rmSync(temporaryHookDirectory, { recursive: true, force: true });
  }
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

  if (commandInvokesWriteReviewStamp(input.tool_input?.command ?? '')) {
    rememberCodexReviewStampIdentity({
      projectDirectory,
      sessionId: input.session_id,
    });
  }

  for (const targetPath of extractTargetPaths(input)) {
    if (maybeDenyTestDefinitionsWrite(projectDirectory, targetPath)) return;
  }
}

async function runSessionStart(): Promise<void> {
  const rawInput = await readStdin();
  const projectDirectory = resolveProjectDirectory();
  const packagedOutput = runPackagedHook('session-codex-start.ts', rawInput, projectDirectory);
  if (packagedOutput.trim() !== '') {
    process.stdout.write(packagedOutput);
    return;
  }

  const input = parseCodexHookInput(rawInput);
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
  const rawInput = await readStdin();
  const projectDirectory = resolveProjectDirectory();
  const qualityOutput = runPackagedHook('codex/post-tool-quality.ts', rawInput, projectDirectory);
  if (qualityOutput.trim() !== '') {
    process.stdout.write(qualityOutput);
    return;
  }

  const skillNudgeOutput = runPackagedHook(
    'codex/post-tool-skill-nudge.ts',
    rawInput,
    projectDirectory,
  );
  if (skillNudgeOutput.trim() !== '') {
    process.stdout.write(skillNudgeOutput);
    return;
  }

  const additionalContext = readProjectTextFile(projectDirectory, POST_TOOL_GUIDANCE_PATH)?.trim();
  if (!additionalContext) return;

  emitAdditionalContext({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext,
    },
  });
}

async function runUserPromptSubmit(): Promise<void> {
  await runProjectAdditionalContext('UserPromptSubmit', PROMPT_CONTEXT_PATH);
}

async function runStop(): Promise<void> {
  const rawInput = await readStdin();
  const projectDirectory = resolveProjectDirectory();
  const packagedOutput = runPackagedHook('codex/stop.ts', rawInput, projectDirectory);
  const trimmedPackagedOutput = packagedOutput.trim();
  if (trimmedPackagedOutput !== '' && trimmedPackagedOutput !== '{}') {
    process.stdout.write(packagedOutput);
    return;
  }

  const reason = readProjectTextFile(projectDirectory, STOP_CONTINUATION_PATH)?.trim();
  if (reason) {
    emitStopContinuation({ decision: 'block', reason });
    return;
  }

  if (trimmedPackagedOutput !== '') {
    process.stdout.write(packagedOutput);
    return;
  }

  emitStopNoop();
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
