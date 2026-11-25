import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import type { Readable } from 'node:stream';

import { OPENCODE_V2_PLUGIN_LAYOUT as layout } from '../schema.js';
import { getTemplatesDirectory } from '../utils/fs.js';
import { openCodeProfilePaths } from './config-root.js';
import { type OpenCodeV2Enrollment, openCodeV2PayloadDigest } from './v2-enrollment.js';
import { stageOpenCodeV2Profile } from './v2-profile.js';

interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

const terminalDriver = String.raw`import os, pty, sys, signal, fcntl, termios, struct, select
pid, fd = pty.fork()
if pid == 0:
    os.close(3)
    os.execv(sys.argv[1], sys.argv[1:])
os.write(3, (str(pid) + '\n').encode())
def cancel(signum, frame):
    try: os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError: pass
    os.waitpid(pid, 0)
    os.write(3, b'reaped\n')
    sys.exit(128 + signum)
signal.signal(signal.SIGTERM, cancel)
fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', 48, 160, 0, 0))
inputs = [fd, 0]
while True:
    ready, _, _ = select.select(inputs, [], [])
    if fd in ready:
        try: output = os.read(fd, 65536)
        except OSError: break
        if not output: break
        os.write(1, output)
    if 0 in ready:
        data = os.read(0, 65536)
        if data: os.write(fd, data)
        else: inputs.remove(0)
_, status = os.waitpid(pid, 0)
try: os.killpg(pid, signal.SIGKILL)
except ProcessLookupError: pass
os.write(3, b'reaped\n')
sys.exit(os.waitstatus_to_exitcode(status))
`;

function terminalPython(): string {
  // Resolve through the parent's working runtime before HOME/config isolation.
  const probe = spawnSync(
    'python3',
    ['-c', 'import os,sys,pty,fcntl,termios; print(os.path.realpath(sys.executable))'],
    {
      env: process.env,
      encoding: 'utf8',
      timeout: 10_000,
    },
  );
  if (probe.status !== 0 || probe.error || !nodePath.isAbsolute(probe.stdout.trim()))
    throw new Error('A working parent Python 3 runtime is required for isolated TUI capture.');
  return realpathSync(probe.stdout.trim());
}

function runHostAsync(
  executable: string,
  args: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
  terminal?: { python: string; finish: string },
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      terminal?.python ?? executable,
      terminal ? ['-c', terminalDriver, executable, ...args] : args,
      {
        cwd,
        env: environment,
        detached: true,
        stdio: terminal ? ['pipe', 'pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
      },
    );
    let stdout = '';
    let stderr = '';
    let failure: Error | undefined;
    let exiting = false;
    let terminalPid: number | undefined;
    let reaped = false;
    if (terminal) {
      const channel = child.stdio[3] as Readable;
      let reportedPid = '';
      channel.setEncoding('utf8').on('data', (chunk: string) => {
        reportedPid += chunk;
        if (reportedPid.includes('reaped\n')) reaped = true;
        if (!reportedPid.includes('\n')) return;
        const pid = Number(reportedPid.split('\n', 1)[0]);
        if (Number.isSafeInteger(pid) && pid > 1) terminalPid = pid;
      });
    }
    const killGroup = (pid: number, signal: NodeJS.Signals) => {
      try {
        process.kill(process.platform === 'win32' ? pid : -pid, signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') failure = error as Error;
      }
    };
    let escalation: ReturnType<typeof setTimeout> | undefined;
    const terminate = () => {
      if (escalation) return;
      try {
        if (terminal) child.kill('SIGTERM');
        else if (child.pid) killGroup(child.pid, 'SIGTERM');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') failure = error as Error;
      }
      escalation = setTimeout(() => {
        try {
          if (terminalPid && !reaped) killGroup(terminalPid, 'SIGKILL');
          if (child.pid) killGroup(child.pid, 'SIGKILL');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') failure = error as Error;
        }
      }, 1000);
    };
    const timeout = setTimeout(() => {
      failure = new Error('OpenCode conformance fixture timed out');
      terminate();
    }, 30_000);
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
      if (terminal && !exiting && stdout.includes(terminal.finish)) {
        exiting = true;
        child.stdin.write('\u{3}\u{3}');
      }
      if (stdout.length > 10 * 1024 * 1024) {
        failure = new Error('OpenCode conformance output exceeded its limit');
        terminate();
      }
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 10 * 1024 * 1024) {
        failure = new Error('OpenCode conformance output exceeded its limit');
        terminate();
      }
    });
    child.stdin.on('error', error => {
      if ((error as NodeJS.ErrnoException).code !== 'EPIPE') failure = error;
    });
    if (!terminal) child.stdin.end();
    child.once('error', error => {
      failure = error;
    });
    child.once('exit', () => {
      if (terminal || !child.pid) return;
      try {
        killGroup(child.pid, 'SIGKILL');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') failure = error as Error;
      }
    });
    child.once('close', exitCode => {
      clearTimeout(timeout);
      if (terminalPid && !reaped) killGroup(terminalPid, 'SIGKILL');
      if (escalation) clearTimeout(escalation);
      child.stdin.end();
      if (failure) reject(failure);
      else resolve({ exitCode: exitCode ?? -1, stdout, stderr });
    });
  });
}

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function toolResponse(name: string, args: unknown, id: string): string {
  return [
    sse({
      id: 'chatcmpl-safeword',
      object: 'chat.completion.chunk',
      choices: [{ delta: { role: 'assistant' } }],
    }),
    sse({
      id: 'chatcmpl-safeword',
      object: 'chat.completion.chunk',
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id,
                type: 'function',
                function: { name, arguments: JSON.stringify(args) },
              },
            ],
          },
        },
      ],
    }),
    sse({
      id: 'chatcmpl-safeword',
      object: 'chat.completion.chunk',
      choices: [{ delta: {}, finish_reason: 'tool_calls' }],
    }),
    'data: [DONE]\n\n',
  ].join('');
}

function stopResponse(content = 'done'): string {
  return [
    sse({
      id: 'chatcmpl-safeword',
      object: 'chat.completion.chunk',
      choices: [{ delta: { role: 'assistant', content } }],
    }),
    sse({
      id: 'chatcmpl-safeword',
      object: 'chat.completion.chunk',
      choices: [{ delta: {}, finish_reason: 'stop' }],
    }),
    'data: [DONE]\n\n',
  ].join('');
}

function decodeModelRequest(
  raw: string,
): { stream: boolean; tools: unknown[]; messages: { role?: string }[] } | undefined {
  try {
    const body = JSON.parse(raw) as {
      stream?: boolean;
      tools?: unknown[];
      messages?: { role?: string }[];
    };
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      (['tools', 'messages'] as const).some(
        name => body[name] !== undefined && !Array.isArray(body[name]),
      )
    )
      return undefined;
    return {
      stream: body.stream !== false,
      tools: body.tools ?? [],
      messages: body.messages ?? [],
    };
  } catch {
    return undefined;
  }
}

const nativeTurnComplete = 'SAFEWORD_NATIVE_TURN_COMPLETE';

function nativeModelTurn(
  raw: string,
  model: { attempts: number; results: unknown[] },
  response: ServerResponse,
): boolean | undefined {
  const body = decodeModelRequest(raw);
  if (!body) {
    response.writeHead(400);
    response.end('Invalid JSON model request');
    return undefined;
  }
  const results = body.messages.filter(message => message?.role === 'tool');
  if (results.length > 0) model.results = results;
  if (!body.stream) {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        id: 'fixture',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Fixture title' },
            finish_reason: 'stop',
          },
        ],
      }),
    );
    return undefined;
  }
  return body.tools.length === 0;
}

function replyModelTurn(
  response: ServerResponse,
  {
    title,
    emitted,
    command,
    model,
    continuation,
  }: {
    title: boolean;
    emitted: boolean;
    command: string;
    model: { attempts: number };
    continuation?: (index: number) => { name: string; input: object } | undefined;
  },
): boolean {
  if (title) {
    response.end(stopResponse('Fixture title'));
    return emitted;
  }
  const next = emitted ? continuation?.(model.attempts - 1) : undefined;
  if (emitted && !next) {
    response.end(stopResponse(nativeTurnComplete));
    return emitted;
  }
  model.attempts++;
  const call = next ?? { name: 'shell', input: { command } };
  response.end(toolResponse(call.name, call.input, `call_safeword_${model.attempts}`));
  return true;
}
function loopbackServer(
  command: string,
  observedModel?: { attempts: number; results: unknown[] },
  continuation?: (index: number) => { name: string; input: object } | undefined,
) {
  let emitted = false;
  const model = observedModel ?? { attempts: 0, results: [] as unknown[] };
  return createServer((request, response) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => (raw += chunk));
    request.on('end', () => {
      const title = nativeModelTurn(raw, model, response);
      if (title === undefined) return;
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      emitted = replyModelTurn(response, {
        title,
        emitted,
        command,
        model,
        continuation,
      });
    });
  });
}

function writeLoopbackConfig(project: string, baseURL: string): void {
  writeFileSync(
    nodePath.join(project, 'opencode.json'),
    JSON.stringify({
      enabled_providers: ['test'],
      model: 'test/test-model',
      small_model: 'test/test-model',
      formatter: false,
      lsp: false,
      provider: {
        test: {
          name: 'Test',
          id: 'test',
          env: [],
          npm: '@ai-sdk/openai-compatible',
          models: {
            'test-model': {
              id: 'test-model',
              name: 'Test Model',
              tool_call: true,
              limit: { context: 100_000, output: 10_000 },
            },
          },
          options: { apiKey: 'test-key', baseURL },
        },
      },
    }),
  );
}

function fixtureEnvironment(root: string, environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...environment,
    PATH: `${nodePath.join(root, 'bin')}${nodePath.delimiter}${environment.PATH ?? ''}`,
    HOME: nodePath.join(root, 'home'),
    XDG_CONFIG_HOME: nodePath.join(root, 'xdg-config'),
    XDG_DATA_HOME: nodePath.join(root, 'xdg-data'),
    XDG_CACHE_HOME: nodePath.join(root, 'xdg-cache'),
    OPENCODE_CONFIG_DIR: nodePath.join(root, 'config'),
    OPENCODE_DISABLE_AUTOUPDATE: 'true',
  };
}

function prepareSyntheticProject(project: string): void {
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  cpSync(
    nodePath.join(getTemplatesDirectory(), 'hooks'),
    nodePath.join(project, '.safeword', 'hooks'),
    { recursive: true },
  );
  writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), '# Safeword\n');
}

interface CaptureOutput {
  readonly bytes: number;
  readonly sha256: string;
  readonly tail: string;
}

function summarizeCaptureOutput(output: string): CaptureOutput {
  const bytes = Buffer.from(output);
  return {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    tail: bytes.subarray(-4096).toString('utf8'),
  };
}

export interface OpenCodeV2Capture {
  readonly outcome: 'unavailable' | 'failed' | 'passed';
  readonly registrations?: readonly {
    id: string;
    required: boolean;
    state: 'rejected' | 'active';
    cause?: string;
  }[];
  readonly guarantees?: readonly { id: 'reject_action'; state: 'proved' }[];
  readonly native_activation?: {
    event: 'pre_tool';
    session_id_sha256: string;
    observed_at: string;
  };
  readonly observations_sha256?: string;
  readonly representation?: string;
  readonly reason:
    | 'missing-native-observations'
    | 'host-exit'
    | 'capture-error'
    | 'identity-changed'
    | 'validated-native-observations';
  readonly exit_code?: number;
  readonly stdout?: CaptureOutput;
  readonly stderr?: CaptureOutput;
  readonly error?: string;
}

function requirePayloadSnapshot(directory: string, expected: string, stage: string): void {
  if (openCodeV2PayloadDigest(directory) !== expected)
    throw new Error(`Package payload changed during ${stage}.`);
}

function captureReason(
  outcome: OpenCodeV2Capture['outcome'],
  exitCode: number,
): OpenCodeV2Capture['reason'] {
  if (outcome === 'unavailable')
    return exitCode === 0 ? 'missing-native-observations' : 'host-exit';
  return 'validated-native-observations';
}

/** Capture is diagnostic input, never a success record or admission authority. */
export async function captureOpenCodeV2(
  executable: string,
  environment: NodeJS.ProcessEnv,
  enrollment: OpenCodeV2Enrollment,
  {
    runtime,
    version,
    realBun,
    payloadSha256,
  }: {
    runtime: 'CLI' | 'TUI';
    version: string;
    realBun: string | undefined;
    payloadSha256: string;
  },
): Promise<OpenCodeV2Capture> {
  const temporaryRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-opencode-conformance-'));
  const root = realpathSync(temporaryRoot);
  const project = nodePath.join(root, 'project');
  const candidate = nodePath.join(root, 'candidate');
  const nonce = randomUUID();
  const control = `native-control-${nonce}.txt`;
  const command = `printf %s ${nonce} > ${control}`;
  const denied = `.project/tickets/native-guard-${nonce}/ticket.md`;
  const deniedCommand = `printf %s ${nonce} > ${denied}`;
  const model = { attempts: 0, results: [] as unknown[] };
  const extra = [
    { name: 'skill', input: { id: 'safeword-explain' } },
    { name: 'skill', input: { id: 'safeword-cleanup-zombies' } },
    { name: 'shell', input: { command: deniedCommand } },
  ];
  const server = loopbackServer(command, model, index =>
    activeV2Candidate(root, candidate) ? extra[index] : undefined,
  );
  try {
    const terminal =
      runtime === 'TUI' ? { python: terminalPython(), finish: nativeTurnComplete } : undefined;
    prepareSyntheticProject(project);
    mkdirSync(nodePath.dirname(nodePath.join(project, denied)), { recursive: true });
    const payload = payloadSha256;
    requirePayloadSnapshot(enrollment.package_directory, payload, 'snapshot');
    cpSync(enrollment.package_directory, candidate, { recursive: true, dereference: true });
    requirePayloadSnapshot(candidate, payload, 'copy');

    const isolated = fixtureEnvironment(root, { PATH: environment.PATH });
    isolated.TERM = 'xterm-256color';
    isolated.XDG_STATE_HOME = nodePath.join(root, 'xdg-state');
    for (const name of [
      'HOME',
      'XDG_CONFIG_HOME',
      'XDG_DATA_HOME',
      'XDG_CACHE_HOME',
      'XDG_STATE_HOME',
      'OPENCODE_CONFIG_DIR',
    ])
      mkdirSync(String(isolated[name]), { recursive: true });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Loopback fixture did not bind');
    prepareV2Observer(root, candidate, realBun);
    const isolatedProfile = String(isolated.OPENCODE_CONFIG_DIR);
    const enrolled = stageOpenCodeV2Profile(
      isolatedProfile,
      openCodeProfilePaths(isolatedProfile).lock,
      {
        projectDirectory: project,
        packageDirectory: candidate,
        epoch: enrollment.epoch,
      },
    );
    if (!['healthy', 'changed'].includes(enrolled.state))
      throw new Error('Isolated fixture enrollment failed');
    writeLoopbackConfig(project, `http://127.0.0.1:${address.port}/v1`);
    const args =
      runtime === 'CLI'
        ? [
            'run',
            '--standalone',
            '--auto',
            '--format',
            'json',
            '--model',
            'test/test-model',
            'Perform the isolated Safeword control.',
          ]
        : ['--standalone', '--auto', '--prompt', 'Perform the isolated Safeword control.'];
    const execution = await runHostAsync(executable, args, project, isolated, terminal);
    requirePayloadSnapshot(enrollment.package_directory, payload, 'capture');
    requirePayloadSnapshot(candidate, payload, 'capture');
    const observed = validateV2Rejection({
      root,
      candidate,
      version,
      command,
      control,
      nonce,
      model,
      execution,
      denied,
      extra,
    });
    return {
      ...observed,
      reason: captureReason(observed.outcome, execution.exitCode),
      exit_code: execution.exitCode,
      stdout: summarizeCaptureOutput(execution.stdout),
      stderr: summarizeCaptureOutput(execution.stderr),
    };
  } catch (error) {
    return {
      outcome: 'unavailable',
      reason: 'capture-error',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve =>
      server.close(() => {
        resolve();
      }),
    );
    rmSync(root, { recursive: true, force: true });
  }
}

function prepareV2Observer(root: string, candidate: string, realBun: string | undefined): void {
  if (!realBun) throw new Error('Installed parent Bun runtime unavailable');
  const observer = nodePath.join(root, 'observer');
  mkdirSync(observer);
  mkdirSync(nodePath.join(root, 'bin'));
  const log = JSON.stringify(nodePath.join(root, 'native-observations.jsonl'));
  writeFileSync(
    nodePath.join(observer, 'index.ts'),
    [
      'import { Plugin } from "@opencode/plugin"; import { appendFileSync } from "node:fs";',
      'export default Plugin.define({id:"safeword-conformance-observer",async setup(ctx){',
      String.raw`appendFileSync(${log},JSON.stringify({setup:true,version:ctx.app.version})+"\n");`,
      String.raw`await ctx.tool.hook("execute.before",async e=>appendFileSync(${log},JSON.stringify({tool:e.tool,input:e.input,session_id:e.sessionID,observed_at:new Date().toISOString(),plugins:(await ctx.plugin.list()).data})+"\n"));`,
      '}});',
    ].join('\n'),
  );
  writeFileSync(
    nodePath.join(root, 'config/opencode.jsonc'),
    JSON.stringify({ plugins: [observer] }),
  );
  const proxy = nodePath.join(root, 'dispatch-observer.mjs');
  writeFileSync(
    proxy,
    String.raw`import{spawnSync}from'node:child_process';import{readFileSync,appendFileSync}from'node:fs';
const args=process.argv.slice(2),observe=args.includes(${JSON.stringify(nodePath.join(candidate, layout.dispatcher))});
const input=observe?readFileSync(0):undefined;
const r=spawnSync(${JSON.stringify(realBun)},args,{input,stdio:observe?['pipe','pipe','pipe']:'inherit'});
if(observe){appendFileSync(${JSON.stringify(nodePath.join(root, 'runtime-observations.jsonl'))},JSON.stringify({args,input:input.toString(),status:r.status})+'\n');process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');}
process.exitCode=r.status??1;`,
  );
  writeFileSync(nodePath.join(root, 'bin/bun'), `#!/bin/sh\nexec "${realBun}" "${proxy}" "$@"\n`, {
    mode: 0o755,
  });
}

interface NativeObservation {
  observed_at?: string;
  setup?: boolean;
  version?: string;
  tool?: string;
  input?: { command?: string; id?: string };
  session_id?: string;
  plugins?: { source?: { path?: string }; state?: { status?: string } }[];
}
/** The SDK reports a local module by its package root or canonical schema entry. */
function candidateRows(row: NativeObservation, candidate: string) {
  const entry = nodePath.join(candidate, layout.entry);
  return (
    row.plugins?.filter(
      plugin => plugin.source?.path === candidate || plugin.source?.path === entry,
    ) ?? []
  );
}
function candidateState(row: NativeObservation, candidate: string, status: string): boolean {
  const matches = candidateRows(row, candidate);
  return matches.length === 1 && matches[0]?.state?.status === status;
}
function candidateActive(row: NativeObservation, candidate: string): boolean {
  return candidateState(row, candidate, 'active');
}
function activeV2Candidate(root: string, candidate: string): boolean {
  try {
    return readFileSync(nodePath.join(root, 'native-observations.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .some(line => candidateActive(JSON.parse(line), candidate));
  } catch {
    return false;
  }
}
function validNativeAction(
  action: NativeObservation | undefined,
  command: string,
  candidate: string,
): boolean {
  if (!action) return false;
  return (
    action.tool === 'shell' &&
    action.input?.command === command &&
    !!action.session_id &&
    Array.isArray(action.plugins) &&
    (candidateRows(action, candidate).length === 0 || candidateState(action, candidate, 'failed'))
  );
}
function validNativeObservations(
  rows: NativeObservation[],
  version: string,
  command: string,
  candidate: string,
): boolean {
  const setups = rows.filter(row => row.setup),
    actions = rows.filter(row => row.tool);
  return (
    setups.length === 1 &&
    setups[0]?.version === version &&
    actions.length === 1 &&
    validNativeAction(actions[0], command, candidate)
  );
}
function rejectedModuleCause(logs: Buffer, candidate: string): string | undefined {
  const matches = logs
    .toString('utf8')
    .split(/(?=timestamp=)/u)
    .filter(
      row =>
        row.includes('message="failed to load plugin"') && row.includes(`target=${candidate} `),
    );
  if (matches.length !== 1) return undefined;
  const encoded = / cause=(?<cause>"(?:[^"\\]|\\.)*")/u.exec(matches[0] ?? '')?.groups?.cause;
  const cause: unknown = encoded ? JSON.parse(encoded) : undefined;
  return typeof cause === 'string' &&
    cause.includes('PluginModule.LoadError') &&
    cause.includes('SchemaError') &&
    cause.includes('["default"]["id"]')
    ? cause
    : undefined;
}
function observedControl(
  root: string,
  probe: { control: string; nonce: string },
  model: { attempts: number; results: unknown[] },
  execution: ProcessResult,
): boolean {
  return (
    execution.exitCode === 0 &&
    model.attempts === 1 &&
    model.results.length > 0 &&
    readFileSync(nodePath.join(root, 'project', probe.control), 'utf8') === probe.nonce &&
    !existsSync(nodePath.join(root, 'runtime-observations.jsonl'))
  );
}
function validGuardAction(
  action: NativeObservation,
  tool: { name: string; input: object } | undefined,
  session: string,
  candidate: string,
): boolean {
  return (
    !!tool &&
    action.session_id === session &&
    candidateActive(action, candidate) &&
    action.tool === tool.name &&
    JSON.stringify(action.input) === JSON.stringify(tool.input)
  );
}
function validGuardDispatch(
  dispatch: { args: string[]; input: string; status: number },
  action: NativeObservation,
  root: string,
  candidate: string,
  status: number,
): boolean {
  const envelope = JSON.parse(dispatch.input);
  return (
    JSON.stringify(dispatch.args) ===
      JSON.stringify([nodePath.join(candidate, layout.dispatcher)]) &&
    dispatch.status === status &&
    envelope.cwd === nodePath.join(root, 'project') &&
    envelope.session_id === action.session_id &&
    envelope.hook_event_name === 'PreToolUse' &&
    envelope.tool_name === (action.tool === 'shell' ? 'Bash' : action.tool) &&
    JSON.stringify(envelope.tool_input) === JSON.stringify(action.input)
  );
}
interface GuardSkill {
  name: string;
  relativePath: string;
  bodyOffset: number;
}

function loadedPackagedSkill(candidate: string, skill: GuardSkill, result?: string): boolean {
  if (!result) return false;
  const file = nodePath.join(candidate, layout.skills, skill.relativePath);
  const body = readFileSync(file, 'utf8').slice(skill.bodyOffset);
  return (
    body.trim().length > 0 &&
    result.includes(body) &&
    result.includes(`Base directory for this skill: ${nodePath.dirname(file)}`)
  );
}

function guardSkillRegistrations(
  candidate: string,
  model: { results: unknown[] },
): OpenCodeV2Capture['registrations'] {
  const results = model.results.map(result => String((result as { content?: unknown }).content));
  const catalogue = JSON.parse(
    readFileSync(nodePath.join(candidate, layout.catalogue), 'utf8'),
  ) as GuardSkill[];
  const cleanup = catalogue.find(entry => entry.name === 'cleanup-zombies');
  const explain = catalogue.find(entry => entry.name === 'explain');
  if (
    !cleanup ||
    !explain ||
    !loadedPackagedSkill(candidate, cleanup, results[2]) ||
    !results[3]?.match(/Safeword denied|Shell commands can't change/u)
  )
    return undefined;

  const explanation = results[1] ?? '';
  const rejection = explanation.includes('Unable to load skill safeword-explain');
  if (!rejection && !loadedPackagedSkill(candidate, explain, explanation)) return undefined;
  return [
    { id: layout.entry, required: true, state: 'active' },
    rejection
      ? { id: 'safeword-explain', required: false, state: 'rejected', cause: explanation }
      : { id: 'safeword-explain', required: false, state: 'active' },
    { id: 'safeword-cleanup-zombies', required: false, state: 'active' },
  ];
}
function completeGuardTurn(
  input: Parameters<typeof validateV2Rejection>[0],
  setups: NativeObservation[],
  actions: NativeObservation[],
): boolean {
  return (
    input.execution.exitCode === 0 &&
    setups.length === 1 &&
    setups[0]?.version === input.version &&
    actions.length === 4 &&
    input.model.attempts === 4 &&
    input.model.results.length === 4
  );
}
function nativeActivation(
  action: NativeObservation | undefined,
): OpenCodeV2Capture['native_activation'] {
  if (!action?.session_id || !action.observed_at) return undefined;
  return {
    event: 'pre_tool',
    session_id_sha256: createHash('sha256').update(action.session_id).digest('hex'),
    observed_at: action.observed_at,
  };
}
function validateV2Guard(
  input: Parameters<typeof validateV2Rejection>[0],
  rows: NativeObservation[],
): OpenCodeV2Capture | undefined {
  const { root, candidate, command, control, nonce, model, extra, denied } = input;
  const setups = rows.filter(row => row.setup),
    actions = rows.filter(row => row.tool);
  if (!completeGuardTurn(input, setups, actions)) return undefined;
  const expected = [{ name: 'shell', input: { command } }, ...extra];
  const runtimeBytes = readFileSync(nodePath.join(root, 'runtime-observations.jsonl'));
  if (runtimeBytes.length > 1024 * 1024) return undefined;
  const dispatches = runtimeBytes
    .toString('utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
  if (dispatches.length !== expected.length) return undefined;
  const session = actions[0]?.session_id;
  if (
    !session ||
    actions.some(
      (action, index) =>
        !validGuardAction(action, expected[index], session, candidate) ||
        !validGuardDispatch(dispatches[index], action, root, candidate, index === 3 ? 2 : 0),
    )
  )
    return undefined;
  if (
    readFileSync(nodePath.join(root, 'project', control), 'utf8') !== nonce ||
    existsSync(nodePath.join(root, 'project', denied))
  )
    return undefined;
  const registrations = guardSkillRegistrations(candidate, model);
  if (!registrations) return undefined;
  const nativeBytes = readFileSync(nodePath.join(root, 'native-observations.jsonl'));
  return {
    outcome: 'passed',
    native_activation: nativeActivation(actions[0]),
    reason: 'validated-native-observations',
    guarantees: [{ id: 'reject_action', state: 'proved' }],
    registrations,
    representation: 'native-runtime-base64/model-canonical-json-v1',
    observations_sha256: createHash('sha256')
      .update(
        JSON.stringify({
          native: nativeBytes.toString('base64'),
          runtime: runtimeBytes.toString('base64'),
          model,
        }),
      )
      .digest('hex'),
  };
}
function validateV2Rejection(input: {
  root: string;
  candidate: string;
  version: string;
  command: string;
  control: string;
  nonce: string;
  model: { attempts: number; results: unknown[] };
  execution: ProcessResult;
  denied: string;
  extra: { name: string; input: object }[];
}): Pick<
  OpenCodeV2Capture,
  'outcome' | 'registrations' | 'guarantees' | 'observations_sha256' | 'representation'
> {
  const { root, candidate, version, command, model, execution } = input;
  const unavailable = { outcome: 'unavailable' as const };
  try {
    const native = readFileSync(nodePath.join(root, 'native-observations.jsonl'));
    const logPath = nodePath.join(root, 'xdg-data/opencode/log/opencode.log');
    const logs = existsSync(logPath) ? readFileSync(logPath) : Buffer.alloc(0);
    if (native.length > 1024 * 1024 || logs.length > 1024 * 1024) return unavailable;
    const rows = native
      .toString('utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line)) as NativeObservation[];
    const positive = validateV2Guard(input, rows);
    if (positive) return positive;
    if (
      !validNativeObservations(rows, version, command, candidate) ||
      !observedControl(root, input, model, execution)
    )
      return unavailable;
    const cause = rejectedModuleCause(logs, candidate);
    if (!cause) return unavailable;
    return {
      outcome: 'failed',
      registrations: [{ id: layout.entry, required: true, state: 'rejected', cause }],
      representation: 'native-and-log-base64/model-canonical-json-v1',
      observations_sha256: createHash('sha256')
        .update(
          JSON.stringify({
            native: native.toString('base64'),
            logs: logs.toString('base64'),
            model,
          }),
        )
        .digest('hex'),
    };
  } catch {
    return unavailable;
  }
}

export function openCodeConformanceFixtureDigest(): string {
  return createHash('sha256')
    .update(readFileSync(import.meta.filename))
    .digest('hex');
}
