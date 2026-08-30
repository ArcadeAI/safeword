import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { legacyCodexEventIsViable } from '../codex-plugin/legacy-authority.js';
import {
  CODEX_PLUGIN_HOOK_EVENTS,
  type CodexPluginHookEvent,
  recordCodexHookProof,
} from '../codex-plugin/profile-proof.js';
import { resolveCodexProjectDirectory } from '../codex-plugin/project-directory.js';
import { generateOwnedPathsModule } from '../owned-paths.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { hasSafewordProjectMarker, resolveNamespaceRoot } from '../utils/configured-paths.js';

type AdditionalContextHookEvent = 'PostToolUse' | 'SessionStart' | 'UserPromptSubmit';
type SupportedCodexHookEvent = CodexPluginHookEvent;

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

interface HookProcessResult {
  error?: Error;
  status?: number;
  stderr: string;
  stdout: string;
}

const EXPLAIN_HINT = 'Run `$explain` for a plain-English version of this block.';
const EXIT_CODE_DENY_MODE = 'exit-code';
const PRE_TOOL_QUALITY_HOOK_PATH = 'codex/pre-tool-quality.ts';
const REQUIRED_INTAKE_FIELDS = ['scope', 'out_of_scope', 'done_when'] as const;
const MODULE_DIRECTORY = import.meta.dirname;
const TEMPLATE_DIRECTORIES = [
  nodePath.resolve(MODULE_DIRECTORY, '../templates'),
  nodePath.resolve(MODULE_DIRECTORY, '../../templates'),
];
const POST_TOOL_GUIDANCE_PATH = '.project/codex-post-tool-guidance.txt';
const PROMPT_CONTEXT_PATH = '.project/codex-prompt-context.txt';
const STOP_CONTINUATION_PATH = '.project/codex-stop-continuation.txt';
const CODEX_RUN_IDENTITY_CACHE = 'codex-run-identity.json';
const CODEX_REVIEW_STAMP_IDENTITY_CACHE = 'codex-review-stamp-identity.json';
const RECORD_SKILL_INVOCATION_SCRIPT = '.safeword/hooks/record-skill-invocation.ts';
const WRITE_REVIEW_STAMP_SCRIPT = '.safeword/hooks/write-review-stamp.ts';
const PACKAGED_RECORD_SKILL_INVOCATION = 'project record-skill-invocation';
const PACKAGED_WRITE_REVIEW_STAMP = 'project runtime write-review-stamp';
const REVIEW_STAMP_CACHE_KEY = 'review-stamp';
const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/u;
const SHELL_SEPARATORS = ';&|';
const SHELL_WHITESPACE = [' ', '\n', '\r', '\t', '\v', '\f'].join('');
const SUPPORTED_CODEX_HOOK_EVENTS: ReadonlySet<string> = new Set(CODEX_PLUGIN_HOOK_EVENTS);

async function readStdin(): Promise<string> {
  stdinCache.body ??= (async () => {
    let body = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) body += String(chunk);
    return body;
  })();
  return await stdinCache.body;
}

const stdinCache: { body?: Promise<string> } = {};

function parseCodexHookInput(raw: string): CodexHookInput | undefined {
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null) return undefined;
    const input = value as Record<string, unknown>;
    return {
      hook_event_name: optionalString(input, 'hook_event_name'),
      session_id: optionalString(input, 'session_id'),
      tool_name: optionalString(input, 'tool_name'),
      tool_input: normalizeToolInput(input.tool_input),
    };
  } catch {
    return undefined;
  }
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === 'string' ? record[key] : undefined;
}

function normalizeToolInput(value: unknown): CodexHookInput['tool_input'] {
  if (typeof value !== 'object' || value === null) return undefined;
  const toolInput = value as Record<string, unknown>;
  return {
    command: optionalString(toolInput, 'command'),
    file_path: optionalString(toolInput, 'file_path'),
    notebook_path: optionalString(toolInput, 'notebook_path'),
  };
}

function normalizeEvent(event: string): SupportedCodexHookEvent | undefined {
  if (SUPPORTED_CODEX_HOOK_EVENTS.has(event)) return event as SupportedCodexHookEvent;
  return undefined;
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

export function parsePackagedRecordSkillInvocation(command: string): string | undefined {
  const packagedIndex = command.indexOf(PACKAGED_RECORD_SKILL_INVOCATION);
  if (packagedIndex === -1) return undefined;
  let nextIndex = packagedIndex + PACKAGED_RECORD_SKILL_INVOCATION.length;
  while (nextIndex < command.length) {
    const argument = readShellArgument(command, nextIndex);
    if (argument === undefined) return undefined;
    nextIndex = argument.nextIndex;
    if (argument.value === '--cwd') {
      const cwd = readShellArgument(command, nextIndex);
      if (cwd === undefined) return undefined;
      nextIndex = cwd.nextIndex;
      continue;
    }
    if (argument.value === '--') continue;
    return SKILL_NAME_PATTERN.test(argument.value) ? argument.value : undefined;
  }
  return undefined;
}

function parseRecordSkillInvocationCommand(command: string): string | undefined {
  const scriptIndex = command.indexOf(RECORD_SKILL_INVOCATION_SCRIPT);
  if (scriptIndex === -1) return parsePackagedRecordSkillInvocation(command);

  let nextIndex = scriptIndex + RECORD_SKILL_INVOCATION_SCRIPT.length;
  const closingQuote = command[nextIndex];
  if (closingQuote === '"' || closingQuote === "'") nextIndex += 1;

  const projectArgument = readShellArgument(command, nextIndex);
  if (!projectArgument) return undefined;

  const skillArgument = readShellArgument(command, projectArgument.nextIndex);
  const skillName = skillArgument?.value;
  return skillName && SKILL_NAME_PATTERN.test(skillName) ? skillName : undefined;
}

export function commandInvokesWriteReviewStamp(command: string): boolean {
  const normalized = command.replaceAll('\\', '/');
  return (
    normalized.includes(WRITE_REVIEW_STAMP_SCRIPT) ||
    normalized.includes(PACKAGED_WRITE_REVIEW_STAMP)
  );
}

function writeCodexIdentityCache(input: {
  projectDirectory: string;
  cacheFile: string;
  sessionId: string | undefined;
  skillName: string | undefined;
}): void {
  if (!hasSafewordProjectMarker(input.projectDirectory)) return;
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

function testDefinitionsTicketFolder(
  projectDirectory: string,
  targetPath: string,
): string | undefined {
  const ticketsDirectory = nodePath.join(resolveNamespaceRoot(projectDirectory), 'tickets');
  const absoluteTarget = nodePath.resolve(projectDirectory, targetPath);
  const normalized = nodePath.relative(ticketsDirectory, absoluteTarget).replaceAll('\\', '/');
  const match = /^([^/]+)\/test-definitions\.md$/u.exec(normalized);
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
  const instructionsPath = findPackagedTemplate('SAFEWORD.md');
  if (!instructionsPath) return undefined;
  if (!readFileSync(instructionsPath, 'utf8').trim()) return undefined;

  return [
    'Current Safeword authority: tickets and their user stories/test definitions live under `.project/` (or the configured namespace root), and current workflow guides live under `.safeword/guides/`.',
    'These current paths supersede retired Safeword instructions that require `planning/` or `docs/` story/test-definition trees or `~/.agents/coding/guides/`.',
    '',
    'Safeword session bootstrap:',
    'Before non-trivial work, read the packaged Safeword handbook and the applicable guide in `.safeword/guides/`.',
    'Current tickets, learnings, and project context are under `.project/` (or the configured namespace root).',
    'Follow the active Safeword workflow and its gates.',
  ].join('\n');
}

function findPackagedTemplate(relativePath: string): string | undefined {
  const directories =
    process.env.SAFEWORD_AGENT_RUNTIME === 'opencode'
      ? [nodePath.join(resolveCodexProjectDirectory(), '.safeword'), ...TEMPLATE_DIRECTORIES]
      : TEMPLATE_DIRECTORIES;
  return directories
    .map(directory => nodePath.join(directory, relativePath))
    .find(candidate => existsSync(candidate));
}

function resolvePackagedHook(relativePath: string): string | undefined {
  return findPackagedTemplate(nodePath.join('hooks', relativePath));
}

function runHookFile(
  hookPath: string,
  rawInput: string,
  projectDirectory: string,
  packagedContextPath = '',
): HookProcessResult {
  const runtime = process.env.SAFEWORD_AGENT_RUNTIME === 'opencode' ? process.execPath : 'bun';
  const result = spawnSync(runtime, [hookPath], {
    cwd: projectDirectory,
    input: rawInput,
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectDirectory,
      SAFEWORD_AGENT_RUNTIME: process.env.SAFEWORD_AGENT_RUNTIME ?? 'codex',
      SAFEWORD_PACKAGED_CONTEXT_PATH: packagedContextPath,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return {
    error: result.error,
    status: result.status ?? undefined,
    stderr: result.stderr ?? '',
    stdout: result.stdout ?? '',
  };
}

export function normalizeNamespaceRootLabel(label: string): string | undefined {
  const normalizedLabel = label.replaceAll('\\', '/');
  return normalizedLabel === '.' ||
    normalizedLabel.startsWith('..') ||
    ['.project', '.safeword-project'].includes(normalizedLabel)
    ? undefined
    : normalizedLabel;
}

export function packagedNamespaceRootLabel(projectDirectory: string): string | undefined {
  return normalizeNamespaceRootLabel(
    nodePath.relative(projectDirectory, resolveNamespaceRoot(projectDirectory)) || '.',
  );
}

function runPackagedHook(
  relativePath: string,
  rawInput: string,
  projectDirectory: string,
): HookProcessResult {
  const hookPath = resolvePackagedHook(relativePath);
  if (!hookPath) {
    return {
      error: new Error(`Safeword packaged hook is missing: ${relativePath}`),
      stderr: '',
      stdout: '',
    };
  }

  let executableHookPath = hookPath;
  let temporaryHookDirectory: string | undefined;

  try {
    if (relativePath === 'session-codex-start.ts') {
      // The installed dispatcher imports a project-generated ownership list. Build
      // that one generated dependency in a temporary package copy for CLI delivery.
      temporaryHookDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
      cpSync(nodePath.dirname(hookPath), temporaryHookDirectory, { recursive: true });
      writeFileSync(
        nodePath.join(temporaryHookDirectory, 'lib', 'owned-paths.ts'),
        generateOwnedPathsModule(SAFEWORD_SCHEMA, packagedNamespaceRootLabel(projectDirectory)),
        'utf8',
      );
      executableHookPath = nodePath.join(temporaryHookDirectory, nodePath.basename(hookPath));
    }

    // The copied dispatcher is observation-only and injects package-owned
    // instructions rather than project-local text.
    const packagedContextPath =
      relativePath === 'session-codex-start.ts' ? (findPackagedTemplate('SAFEWORD.md') ?? '') : '';
    return runHookFile(executableHookPath, rawInput, projectDirectory, packagedContextPath);
  } finally {
    if (temporaryHookDirectory) rmSync(temporaryHookDirectory, { recursive: true, force: true });
  }
}

interface PackagedHookSnapshot {
  directory?: string;
  error?: Error;
  hookPath?: string;
}

function rewriteSnapshotImportsForNode(directory: string): void {
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) {
      rewriteSnapshotImportsForNode(path);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    const source = readFileSync(path, 'utf8');
    const rewritten = source
      .replaceAll(/(from\s+['"]|import\s*\(\s*['"])(\.{1,2}\/[^'"]+)\.js(['"])/gu, '$1$2.ts$3')
      .replace(
        'return JSON.parse(await Bun.stdin.text()) as CodexHookInput;',
        "const raw = (await import('node:fs')).readFileSync(0, 'utf8');\n    return JSON.parse(raw) as CodexHookInput;",
      )
      .replace(
        "return spawnSync('bun', [claudeHookPath], {",
        'return spawnSync(process.execPath, [claudeHookPath], {',
      )
      .replace("SAFEWORD_AGENT_RUNTIME: 'codex',", "SAFEWORD_AGENT_RUNTIME: 'opencode',")
      .replace(
        'input = await Bun.stdin.json();',
        "const raw = (await import('node:fs')).readFileSync(0, 'utf8');\n  input = JSON.parse(raw) as HookInput;",
      );
    if (rewritten !== source) writeFileSync(path, rewritten, 'utf8');
  }
}

function snapshotPackagedHook(relativePath: string): PackagedHookSnapshot {
  const packagedHooksDirectory = findPackagedTemplate('hooks');
  if (!packagedHooksDirectory) {
    return { error: new Error(`Safeword packaged hook is missing: ${relativePath}`) };
  }

  const directory = mkdtempSync(
    nodePath.join(tmpdir(), `safeword-codex-hook-snapshot-${process.pid}-`),
  );
  const stagingHooksDirectory = nodePath.join(directory, 'hooks-copying');
  const snapshotHooksDirectory = nodePath.join(directory, 'hooks');
  try {
    cpSync(packagedHooksDirectory, stagingHooksDirectory, { recursive: true });
    if (process.env.SAFEWORD_AGENT_RUNTIME === 'opencode') {
      rewriteSnapshotImportsForNode(stagingHooksDirectory);
    }
    renameSync(stagingHooksDirectory, snapshotHooksDirectory);
    const hookPath = nodePath.join(snapshotHooksDirectory, relativePath);
    return existsSync(hookPath)
      ? { directory, hookPath }
      : { directory, error: new Error(`Safeword packaged hook is missing: ${relativePath}`) };
  } catch (error) {
    return {
      directory,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function hookFailureDetail(result: HookProcessResult): string {
  return result.stderr.trim() || result.error?.message || 'exited without a failure message';
}

// Exit 2 is a generic packaged-hook denial; exit 3 is the deliberate,
// user-recoverable unfinished-feature close block consumed by OpenCode.
const INCOMPLETE_FEATURE_EVIDENCE_EXIT_CODE = 3;

function denyForPackagedHookFailure(result: HookProcessResult): never {
  const detail = hookFailureDetail(result);
  if (
    process.env.SAFEWORD_CODEX_DENY_MODE === EXIT_CODE_DENY_MODE &&
    result.status === INCOMPLETE_FEATURE_EVIDENCE_EXIT_CODE
  ) {
    process.stderr.write(`${detail}\n`);
    process.exit(INCOMPLETE_FEATURE_EVIDENCE_EXIT_CODE);
  }
  process.stderr.write(`Safeword packaged PreToolUse hook failed: ${detail}\n`);
  process.exit(2);
}

function emitPackagedPreToolResult(result: HookProcessResult): boolean {
  if (result.error || result.status !== 0) denyForPackagedHookFailure(result);
  if (result.stdout.trim() === '') return false;
  if (process.env.SAFEWORD_CODEX_DENY_MODE === EXIT_CODE_DENY_MODE) {
    process.stderr.write(
      'Safeword packaged PreToolUse hook returned unsupported output in exit-code mode.\n',
    );
    process.exit(2);
  }
  process.stdout.write(result.stdout);
  return true;
}

function readProjectTextFile(projectDirectory: string, relativePath: string): string | undefined {
  const filePath = nodePath.join(projectDirectory, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : undefined;
}

function emitAdditionalContext(output: AdditionalContextOutput): void {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function currentTimestampContext(now = new Date()): string {
  const natural = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
  const local = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return `Current time: ${natural} (${now.toISOString()}) | Local: ${local}`;
}

function packagedAdditionalContext(
  result: HookProcessResult,
  hookEventName: AdditionalContextHookEvent,
): string | undefined {
  if (result.error || result.status !== 0 || result.stdout.trim() === '') return undefined;

  try {
    const output = JSON.parse(result.stdout) as Partial<AdditionalContextOutput>;
    const hookOutput = output.hookSpecificOutput;
    return hookOutput?.hookEventName === hookEventName &&
      typeof hookOutput.additionalContext === 'string' &&
      hookOutput.additionalContext.trim() !== ''
      ? hookOutput.additionalContext.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

function emitStopNoop(): void {
  process.stdout.write('{}\n');
}

function emitStopContinuation(output: StopContinuationOutput): void {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function maybeDenyTestDefinitionsWrite(projectDirectory: string, targetPath: string): boolean {
  const ticketFolder = testDefinitionsTicketFolder(projectDirectory, targetPath);
  if (!ticketFolder) return false;

  const ticketPath = nodePath.join(
    resolveNamespaceRoot(projectDirectory),
    'tickets',
    ticketFolder,
    'ticket.md',
  );
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

function runEnrolledPreToolUse(
  rawInput: string,
  projectDirectory: string,
  qualityResult: HookProcessResult,
): void {
  if (emitPackagedPreToolResult(qualityResult)) return;

  const input = parseCodexHookInput(rawInput);
  if (!input) return;

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

async function runPreToolUse(projectDirectory: string): Promise<void> {
  if (!hasSafewordProjectMarker(projectDirectory)) return;

  // bunx uses a shared cache and can replace a package directory while another
  // hook process is still alive. Snapshot the package-owned gate before waiting
  // on stdin so every transitive import stays stable for this tool call.
  const snapshot = snapshotPackagedHook(PRE_TOOL_QUALITY_HOOK_PATH);
  const rawInput = await readStdin();
  const qualityResult: HookProcessResult = snapshot.hookPath
    ? runHookFile(snapshot.hookPath, rawInput, projectDirectory)
    : { error: snapshot.error, stderr: '', stdout: '' };
  if (snapshot.directory) rmSync(snapshot.directory, { recursive: true, force: true });

  runEnrolledPreToolUse(rawInput, projectDirectory, qualityResult);
}

async function runSessionStart(projectDirectory: string): Promise<void> {
  const rawInput = await readStdin();
  const packagedResult = runPackagedHook('session-codex-start.ts', rawInput, projectDirectory);
  if (packagedResult.stdout.trim() !== '') {
    process.stdout.write(packagedResult.stdout);
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

function postToolLintInputs(
  input: CodexHookInput | undefined,
  rawInput: string,
  projectDirectory: string,
): string[] {
  if (input?.tool_name !== 'apply_patch') return [rawInput];

  return extractTargetPaths(input).map(filePath =>
    JSON.stringify({
      tool_input: { file_path: nodePath.resolve(projectDirectory, filePath) },
    }),
  );
}

function collectPostToolLintContexts(lintInputs: string[], projectDirectory: string): string[] {
  const contexts: string[] = [];
  for (const lintInput of lintInputs) {
    const lintResult = runPackagedHook('post-tool-lint.ts', lintInput, projectDirectory);
    const context = packagedAdditionalContext(lintResult, 'PostToolUse');
    const output = lintResult.stdout.trim();
    if (context) contexts.push(context);
    else if (output) contexts.push(output);
  }
  return contexts;
}

async function runPostToolUse(projectDirectory: string): Promise<void> {
  const rawInput = await readStdin();
  if (!hasSafewordProjectMarker(projectDirectory)) return;
  const input = parseCodexHookInput(rawInput);
  const lintInputs = postToolLintInputs(input, rawInput, projectDirectory);
  const contexts = collectPostToolLintContexts(lintInputs, projectDirectory);
  const qualityResult = runPackagedHook('codex/post-tool-quality.ts', rawInput, projectDirectory);
  const qualityContext = packagedAdditionalContext(qualityResult, 'PostToolUse');
  if (qualityContext) contexts.push(qualityContext);

  const skillNudgeResult = runPackagedHook(
    'codex/post-tool-skill-nudge.ts',
    rawInput,
    projectDirectory,
  );
  const skillContext = packagedAdditionalContext(skillNudgeResult, 'PostToolUse');
  if (skillContext) contexts.push(skillContext);

  const additionalContext = readProjectTextFile(projectDirectory, POST_TOOL_GUIDANCE_PATH)?.trim();
  if (additionalContext) contexts.push(additionalContext);
  if (contexts.length === 0) return;

  emitAdditionalContext({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: contexts.join('\n\n'),
    },
  });
}

async function runUserPromptSubmit(projectDirectory: string): Promise<void> {
  const rawInput = await readStdin();
  const contexts = [currentTimestampContext()];
  if (hasSafewordProjectMarker(projectDirectory)) {
    const retroNudge = packagedAdditionalContext(
      runPackagedHook('prompt-retro-nudge.ts', rawInput, projectDirectory),
      'UserPromptSubmit',
    );
    if (retroNudge) contexts.push(retroNudge);
  }

  const queuedContext = readProjectTextFile(projectDirectory, PROMPT_CONTEXT_PATH)?.trim();
  if (queuedContext) contexts.push(queuedContext);

  emitAdditionalContext({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: contexts.join('\n\n'),
    },
  });
}

async function runStop(projectDirectory: string): Promise<void> {
  const rawInput = await readStdin();
  if (!hasSafewordProjectMarker(projectDirectory)) {
    emitStopNoop();
    return;
  }
  const packagedResult = runPackagedHook('codex/stop.ts', rawInput, projectDirectory);
  const trimmedPackagedOutput = packagedResult.stdout.trim();
  if (trimmedPackagedOutput !== '' && trimmedPackagedOutput !== '{}') {
    process.stdout.write(packagedResult.stdout);
    return;
  }

  // `{}` is an intentional packaged no-op, so project-owned continuations still apply.
  const reason = readProjectTextFile(projectDirectory, STOP_CONTINUATION_PATH)?.trim();
  if (reason) {
    emitStopContinuation({ decision: 'block', reason });
    return;
  }

  if (trimmedPackagedOutput !== '') {
    process.stdout.write(packagedResult.stdout);
    return;
  }

  emitStopNoop();
}

const CODEX_HOOK_RUNNERS: Record<SupportedCodexHookEvent, (project: string) => Promise<void>> = {
  'post-tool-use': runPostToolUse,
  'pre-tool-use': runPreToolUse,
  'session-start': runSessionStart,
  stop: runStop,
  'user-prompt-submit': runUserPromptSubmit,
};

export async function codexHook(
  event: string,
  options: { pluginHook?: boolean } = {},
): Promise<void> {
  const normalized = normalizeEvent(event);
  if (normalized === undefined) {
    process.stderr.write(`Safeword ignored unknown Codex hook event: ${event}\n`);
    return;
  }
  const projectDirectory = resolveCodexProjectDirectory();
  if (options.pluginHook === true) {
    try {
      const rawInput = await readStdin();
      const input = parseCodexHookInput(rawInput);
      recordCodexHookProof(normalized, process.env, new Date(), {
        projectDirectory,
        sessionId: input?.session_id,
      });
    } catch {
      // Proof is advisory state. A read-only or malformed CODEX_HOME must never
      // prevent the packaged hook itself from protecting the project.
    }
    if (legacyCodexEventIsViable(projectDirectory, normalized)) return;
  }
  await CODEX_HOOK_RUNNERS[normalized](projectDirectory);
}
