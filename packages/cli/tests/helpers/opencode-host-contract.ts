import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

// OpenAI-compatible SSE shapes are adapted from OpenCode's MIT-licensed
// 1.18.23 test fixture: packages/opencode/test/lib/llm-server.ts.
const OPENCODE_VERSION = '1.18.23';

export interface OpenCodeHostContractEvidence {
  readonly version: string;
  readonly discovered: readonly ['command', 'agent', 'skill'];
  readonly preToolInputKeys: Readonly<
    Record<'bash' | 'shell' | 'edit' | 'write' | 'patch', string>
  >;
  readonly dispatcher: {
    readonly exitCode: number;
    readonly stdout: string;
    readonly awaitedBeforeDenial: boolean;
  };
  readonly denialSentinelExists: boolean;
}

interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Timed out running ${command} ${args.join(' ')}`));
    }, 30_000);
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.once('error', reject);
    child.once('close', exitCode => {
      clearTimeout(timeout);
      resolve({ exitCode: exitCode ?? -1, stdout, stderr });
    });
  });
}

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function toolResponse(model: string) {
  const calls = model.includes('gpt-')
    ? [
        { name: 'bash', arguments: { command: 'touch denied-bash-patch-model' } },
        {
          name: 'apply_patch',
          arguments: {
            patchText: '*** Begin Patch\n*** Add File: denied-patch\n+denied\n*** End Patch',
          },
        },
      ]
    : [
        { name: 'bash', arguments: { command: 'touch denied-bash' } },
        {
          name: 'edit',
          arguments: { filePath: 'denied-edit', oldString: '', newString: 'denied' },
        },
        { name: 'write', arguments: { filePath: 'denied-write', content: 'denied' } },
      ];
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
            tool_calls: calls.map((call, index) => ({
              index,
              id: `call_${index}`,
              type: 'function',
              function: { name: call.name, arguments: JSON.stringify(call.arguments) },
            })),
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

function stopResponse() {
  return [
    sse({
      id: 'chatcmpl-safeword',
      object: 'chat.completion.chunk',
      choices: [{ delta: { role: 'assistant', content: 'done' } }],
    }),
    sse({
      id: 'chatcmpl-safeword',
      object: 'chat.completion.chunk',
      choices: [{ delta: {}, finish_reason: 'stop' }],
    }),
    'data: [DONE]\n\n',
  ].join('');
}

async function fixtureFiles(root: string, llmUrl: string) {
  const config = path.join(root, '.opencode');
  const evidence = path.join(root, 'hook-evidence.jsonl');
  const awaited = path.join(root, 'dispatcher-awaited');
  const dispatcher = path.join(root, 'dispatcher.mjs');
  await Promise.all([
    mkdir(path.join(config, 'commands'), { recursive: true }),
    mkdir(path.join(config, 'agents'), { recursive: true }),
    mkdir(path.join(root, '.claude', 'skills', 'fixture-skill'), { recursive: true }),
    mkdir(path.join(config, 'plugins'), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      path.join(config, 'commands', 'fixture-command.md'),
      '---\ndescription: fixture command\n---\ncommand',
    ),
    writeFile(
      path.join(config, 'agents', 'fixture-agent.md'),
      '---\ndescription: fixture agent\nmode: subagent\n---\nagent',
    ),
    writeFile(
      path.join(root, '.claude', 'skills', 'fixture-skill', 'SKILL.md'),
      '---\nname: fixture-skill\ndescription: fixture skill\n---\nskill',
    ),
    writeFile(
      path.join(root, 'opencode.json'),
      JSON.stringify({
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
              'gpt-5-fixture': {
                id: 'gpt-5-fixture',
                name: 'GPT 5 Fixture',
                tool_call: true,
                limit: { context: 100_000, output: 10_000 },
              },
            },
            options: { apiKey: 'test-key', baseURL: llmUrl },
          },
        },
      }),
    ),
    writeFile(
      dispatcher,
      `import { writeFile } from 'node:fs/promises';\nawait new Promise((resolve) => setTimeout(resolve, 40));\nawait writeFile(${JSON.stringify(awaited)}, 'awaited');\nprocess.stdout.write('fixture-denied');\nprocess.exitCode = 2;\n`,
    ),
    writeFile(
      path.join(config, 'plugins', 'safeword-fixture.js'),
      String.raw`import { appendFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const run = (tool, args) => new Promise((resolve, reject) => {
  const child = spawn(${JSON.stringify(process.execPath)}, [${JSON.stringify(dispatcher)}], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => stdout += chunk);
  child.once('error', reject);
  child.once('close', async (exitCode) => {
    await appendFile(${JSON.stringify(evidence)}, JSON.stringify({ tool, keys: Object.keys(args), exitCode, stdout }) + '\n');
    resolve({ exitCode, stdout });
  });
});
export const SafewordFixture = async () => ({
    'tool.execute.before': async (input, output) => {
      const result = await run(input.tool, output.args);
      if (result.exitCode === 2) throw new Error(result.stdout);
    },
});
`,
    ),
  ]);
}

interface HookEvidence {
  readonly tool: string;
  readonly keys: string[];
  readonly exitCode: number;
  readonly stdout: string;
}

async function exists(file: string): Promise<boolean> {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}

function loopbackServer() {
  const emitted = new Set<string>();
  return createServer((request, response) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => (raw += chunk));
    request.on('end', () => {
      const body = JSON.parse(raw) as { model?: string; messages?: unknown[] };
      const model = body.model ?? '';
      const title = JSON.stringify(body.messages).includes(
        'Generate a title for this conversation',
      );
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      if (title || emitted.has(model)) response.end(stopResponse());
      else {
        emitted.add(model);
        response.end(toolResponse(model));
      }
    });
  });
}

function assertCatalogue(config: ProcessResult, skills: ProcessResult) {
  const resolved = JSON.parse(config.stdout) as {
    command?: Record<string, unknown>;
    agent?: Record<string, unknown>;
  };
  if (!resolved.command?.['fixture-command'])
    throw new Error('OpenCode did not discover the fixture command');
  if (!resolved.agent?.['fixture-agent'])
    throw new Error('OpenCode did not discover the fixture agent');

  const discoveredSkills = JSON.parse(skills.stdout) as { name: string }[];
  if (discoveredSkills.every(skill => skill.name !== 'fixture-skill')) {
    throw new Error('OpenCode did not discover the fixture skill');
  }
}

function requiredKey(
  byTool: Record<string, HookEvidence>,
  tool: string,
  expected: string,
  stderr: string,
) {
  if (!byTool[tool]?.keys.includes(expected)) {
    throw new Error(`OpenCode ${tool} hook did not expose ${expected}: ${stderr}`);
  }
  return expected;
}

async function contractEvidence(
  root: string,
  version: ProcessResult,
  execution: ProcessResult,
): Promise<OpenCodeHostContractEvidence> {
  const evidenceFile = path.join(root, 'hook-evidence.jsonl');
  if (!(await exists(evidenceFile))) {
    throw new Error(
      `OpenCode did not invoke the fixture hook (exit ${execution.exitCode}).\nstdout:\n${execution.stdout}\nstderr:\n${execution.stderr}`,
    );
  }

  const rawEvidence = await readFile(evidenceFile, 'utf8');
  const lines = rawEvidence
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as HookEvidence);
  const byTool = Object.fromEntries(lines.map(line => [line.tool, line]));
  const key = (tool: string, expected: string) =>
    requiredKey(byTool, tool, expected, execution.stderr);
  const sentinels = [
    'denied-bash',
    'denied-bash-patch-model',
    'denied-edit',
    'denied-write',
    'denied-patch',
  ];
  const sentinelResults = await Promise.all(sentinels.map(file => exists(path.join(root, file))));

  return {
    version: version.stdout.trim(),
    discovered: ['command', 'agent', 'skill'],
    preToolInputKeys: {
      bash: key('bash', 'command'),
      shell: key('bash', 'command'),
      edit: key('edit', 'filePath'),
      write: key('write', 'filePath'),
      patch: key('apply_patch', 'patchText'),
    },
    dispatcher: {
      exitCode: lines[0]?.exitCode ?? -1,
      stdout: lines[0]?.stdout ?? '',
      awaitedBeforeDenial: await exists(path.join(root, 'dispatcher-awaited')),
    },
    denialSentinelExists: sentinelResults.some(Boolean),
  };
}

async function exerciseHost(root: string, llmUrl: string): Promise<OpenCodeHostContractEvidence> {
  await fixtureFiles(root, llmUrl);
  const isolatedHome = path.join(root, 'home');
  await mkdir(isolatedHome, { recursive: true });
  const env = {
    ...process.env,
    HOME: isolatedHome,
    XDG_CONFIG_HOME: path.join(root, 'xdg-config'),
    XDG_DATA_HOME: path.join(root, 'xdg-data'),
    XDG_CACHE_HOME: path.join(root, 'xdg-cache'),
    OPENCODE_DISABLE_AUTOUPDATE: 'true',
  };
  const opencode = ['--bun', `opencode-ai@${OPENCODE_VERSION}`] as const;
  const version = await run('bunx', [...opencode, '--version'], root, env);
  const config = await run('bunx', [...opencode, 'debug', 'config'], root, env);
  const skills = await run('bunx', [...opencode, 'debug', 'skill'], root, env);
  if (version.exitCode !== 0 || config.exitCode !== 0 || skills.exitCode !== 0) {
    throw new Error(`OpenCode fixture failed:\n${version.stderr}${config.stderr}${skills.stderr}`);
  }
  assertCatalogue(config, skills);

  const execute = (model: string) =>
    run(
      'bunx',
      [
        ...opencode,
        'run',
        'exercise fixture tools',
        '--model',
        `test/${model}`,
        '--dir',
        root,
        '--auto',
        '--print-logs',
        '--log-level',
        'DEBUG',
      ],
      root,
      env,
    );
  const editExecution = await execute('test-model');
  const patchExecution = await execute('gpt-5-fixture');
  return contractEvidence(root, version, {
    exitCode: Math.max(editExecution.exitCode, patchExecution.exitCode),
    stdout: editExecution.stdout + patchExecution.stdout,
    stderr: editExecution.stderr + patchExecution.stderr,
  });
}

export async function proveOpenCodeHostContract(): Promise<OpenCodeHostContractEvidence> {
  const root = await mkdtemp(path.join(tmpdir(), 'safeword-opencode-contract-'));
  const server = loopbackServer();
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('OpenCode fixture server did not bind');
    return await exerciseHost(root, `http://127.0.0.1:${address.port}/v1`);
  } finally {
    server.close();
    await rm(root, { recursive: true, force: true });
  }
}
