import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import nodePath from 'node:path';

import { runOpenCodeCommand } from './opencode-native-command.js';
export interface ModelMessage {
  role: string;
  content?: unknown;
}

function modelToolNames(tools?: { function?: { name?: string } }[]): string[] {
  return tools?.flatMap(tool => tool.function?.name ?? []) ?? [];
}

function toolArguments(tool: string | undefined, command: string): string {
  return JSON.stringify(
    tool === 'bash' ? { command, description: 'Observe the native boundary' } : { command },
  );
}

export interface NativeModelRequest {
  stream?: boolean;
  tools?: { function?: { name?: string } }[];
  messages?: ModelMessage[];
}

export interface NativeModelReply {
  tool?: { name: string; input: object };
  text?: string;
}

/** Model transport only: scripted tool requests still execute through the actual host. */
export async function openCodeScriptedModelFixture(
  directory: string,
  reply: (request: NativeModelRequest) => NativeModelReply,
) {
  const results: ModelMessage[] = [];
  let attempts = 0;
  const finish = 'SAFEWORD_NATIVE_TURN_COMPLETE';
  const server = createServer((request, response) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      raw += chunk;
    });
    request.on('end', () => {
      const body = JSON.parse(raw) as NativeModelRequest;
      const received = body.messages?.filter(message => message.role === 'tool') ?? [];
      results.push(...received);
      if (body.stream === false) {
        response.setHeader('content-type', 'application/json');
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
        return;
      }
      // V2 also streams auxiliary title requests without tools. They are not agent turns.
      const answer =
        modelToolNames(body.tools).length > 0 ? reply(body) : { text: 'Fixture title' };
      const tool = answer.tool;
      const call = tool !== undefined;
      if (call) attempts++;
      const delta = call
        ? {
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: 'call_safeword_native',
                type: 'function',
                function: { name: tool.name, arguments: JSON.stringify(tool.input) },
              },
            ],
          }
        : { role: 'assistant', content: answer.text ?? finish };
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      const choices = [
        [{ index: 0, delta }],
        [{ index: 0, delta: {}, finish_reason: call ? 'tool_calls' : 'stop' }],
      ];
      for (const choice of choices)
        response.write(
          `data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', choices: choice })}\n\n`,
        );
      response.end('data: [DONE]\n\n');
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    finish,
    results,
    get attempts() {
      return attempts;
    },
    close() {
      writeFileSync(
        nodePath.join(directory, 'native-model-observations.json'),
        JSON.stringify({ attempts, results }),
      );
      server.closeAllConnections();
      server.close();
    },
  };
}

/** The paired write probe shares its transport with catalogue/worker probes. */
export function openCodeModelFixture(command: string, directory: string) {
  return openCodeScriptedModelFixture(directory, request => {
    const tools = modelToolNames(request.tools);
    const tool = tools.find(name => name === 'bash' || name === 'shell');
    const received = request.messages?.some(message => message.role === 'tool') ?? false;
    return tool && !received
      ? { tool: { name: tool, input: JSON.parse(toolArguments(tool, command)) as object } }
      : { text: tools.length > 0 ? 'SAFEWORD_NATIVE_TURN_COMPLETE' : 'Fixture title' };
  });
}

/** Run either the real CLI or real TUI, preserving terminal bytes for diagnosis. */
export interface OpenCodeTurnInput {
  binary: string;
  version: string;
  runtime: 'CLI' | 'TUI';
  project: string;
  environment: NodeJS.ProcessEnv;
  finish: string;
  directory: string;
  prompt?: string;
  command?: string;
}

function nativeArguments(input: OpenCodeTurnInput): string[] {
  const v2 = input.version.startsWith('2.');
  const prompt = input.command ? `/${input.command} ${input.prompt ?? ''}` : input.prompt;
  const tuiArguments = input.command
    ? ['--auto']
    : ['--auto', '--prompt', prompt ?? 'Perform the isolated native write.'];
  const args =
    input.runtime === 'CLI'
      ? [
          'run',
          '--auto',
          '--format',
          'json',
          '--model',
          'fixture/model',
          prompt ?? 'Perform the isolated native write.',
        ]
      : tuiArguments;
  if (v2) args.splice(input.runtime === 'CLI' ? 1 : 0, 0, '--standalone');
  return args;
}

/** Wait for a rendered native catalogue before submitting the tested slash command. */
function nativeCommandInput(input: OpenCodeTurnInput, write: (text: string) => void) {
  if (input.runtime !== 'TUI' || !input.command) return () => {};
  let state: 'input' | 'catalogue' | 'typed' | 'submitted' = 'input';
  const control = '/safeword-driver-ready';
  return (output: string) => {
    if (state === 'input' && output.includes('Ask anything')) {
      state = 'catalogue';
      write(control);
    } else if (state === 'catalogue' && output.includes('SAFEWORD_COMMANDS_READY')) {
      state = 'typed';
      write(
        `${'\u{7F}'.repeat(control.length)}\u{1B}[200~/${input.command} ${input.prompt ?? ''}\u{1B}[201~`,
      );
    } else if (state === 'typed' && input.prompt && output.includes(input.prompt)) {
      state = 'submitted';
      write('\r');
    }
  };
}

export async function runOpenCodeTurn(
  input: OpenCodeTurnInput,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  if (input.command && input.runtime === 'CLI') return runOpenCodeCommand(input);
  const args = nativeArguments(input);
  const pty = nodePath.resolve(import.meta.dirname, '../fixtures/host-contract/native-pty.py');
  const executable = input.runtime === 'TUI' ? 'python3' : input.binary;
  const argv = input.runtime === 'TUI' ? [pty, input.binary, ...args] : args;
  const child = spawn(executable, argv, {
    cwd: input.project,
    env: { ...input.environment, TERM: 'xterm-256color' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (input.runtime === 'CLI') child.stdin.end();
  let stdout = '';
  let stderr = '';
  let exiting = false;
  const commandInput = nativeCommandInput(input, text => child.stdin.write(text));
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;
    commandInput(stdout);
    if (input.runtime === 'TUI' && !exiting && stdout.includes(input.finish)) {
      exiting = true;
      child.stdin.write('\u{3}\u{3}');
    }
  });
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });
  const timer = setTimeout(() => child.kill('SIGTERM'), 60_000);
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    writeFileSync(nodePath.join(input.directory, 'native-output.log'), stdout);
    writeFileSync(nodePath.join(input.directory, 'native-stderr.log'), stderr);
    assert.equal(code, 0, 'HOST_CONTRACT_PROOF_UNAVAILABLE: native host did not finish');
    assert.ok(
      stdout.includes(input.finish),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: no native completion',
    );
    return { stdout, stderr, code };
  } finally {
    clearTimeout(timer);
    child.stdin.end();
  }
}
