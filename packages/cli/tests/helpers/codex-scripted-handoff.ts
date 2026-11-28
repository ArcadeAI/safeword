import assert from 'node:assert/strict';
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { once } from 'node:events';
import { appendFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import nodePath from 'node:path';
import { createInterface } from 'node:readline';

import type { CodexGuardFixture, Event } from './codex-native-continuation.js';

const model = 'gpt-5.6-terra';
const correctionReply = [
  '**CONFIDENT** — The packaged helper completed.',
  '**Decided:** Leave the private project unchanged.',
  '**Open:** none.',
  '**Next:** Action: Continue. Object: the native test.',
].join('\n\n');

type ModelInput = {
  role?: string;
  type: string;
  call_id?: string;
  content?: { text?: string }[];
};
type NativeItem = {
  type: string;
  text?: string;
  command?: string;
  aggregatedOutput?: string;
  exitCode?: number;
};
type NativeMessage = {
  id?: number;
  method?: string;
  result?: { thread?: { id: string }; turn?: { id: string } };
  error?: unknown;
  params?: {
    item?: NativeItem;
    turn?: { id: string; status: string; error?: unknown };
  };
};

function responseItem(index: number, output: string, tool: boolean) {
  if (tool) {
    return {
      type: 'custom_tool_call',
      id: `fc_${index}`,
      call_id: `call_${index}`,
      namespace: 'functions',
      name: 'exec',
      input: `const result = await tools.exec_command({cmd:${JSON.stringify(output)}}); text(result.output);`,
      status: 'completed',
    };
  }
  return {
    type: 'message',
    id: `msg_${index}`,
    role: 'assistant',
    phase: 'final_answer',
    status: 'completed',
    content: [{ type: 'output_text', text: output, annotations: [] }],
  };
}

function completedItem(item: NativeItem): Event | undefined {
  if (item.type === 'agentMessage')
    return { type: 'item.completed', item: { type: 'agent_message', text: item.text } };
  if (item.type === 'commandExecution')
    return {
      type: 'item.completed',
      item: {
        type: 'command_execution',
        command: item.command,
        aggregated_output: item.aggregatedOutput,
        exit_code: item.exitCode,
      },
    };
  return undefined;
}

/** Only the model replies are scripted. Commands and hook continuations go through Codex. */
export class CodexScriptedHandoff {
  private readonly server = createServer((request, response) => {
    void this.serve(request, response);
  });
  private process?: ChildProcessWithoutNullStreams;
  private rows?: AsyncIterator<string>;
  private thread = '';
  private nextRequest = 0;
  private nextResponse = 0;
  private launchArguments?: string[];
  private active?: {
    command: string;
    answer: string;
    toolCall?: string;
    answered: boolean;
    corrected: boolean;
  };

  constructor(
    private readonly fixture: CodexGuardFixture,
    private readonly environment: NodeJS.ProcessEnv,
    private readonly directory: string,
  ) {}

  private async serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.headers.authorization) {
      response.writeHead(403).end();
      return;
    }
    if (request.method === 'GET' && request.url?.split('?', 1)[0] === '/v1/models') {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end('{"data":[]}');
      return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/responses') {
      response.writeHead(404).end();
      return;
    }
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        assert.ok(Buffer.isBuffer(chunk));
        size += chunk.length;
        assert.ok(size < 4 * 1024 * 1024, 'Scripted request exceeded size limit');
        chunks.push(chunk);
      }
      const { input } = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
        input: ModelInput[];
      };
      this.writeResponse(response, input);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown scripted model error';
      appendFileSync(nodePath.join(this.directory, 'scripted-model-errors.log'), `${reason}\n`);
      response.writeHead(422).end();
    }
  }

  private selectResponse(input: ModelInput[]) {
    const active = this.active;
    assert.ok(active, 'Model request outside a scripted turn');
    const index = ++this.nextResponse;
    if (active.answered) {
      const lastUser = input.findLast(row => row.role === 'user');
      assert.ok(
        !active.corrected &&
          lastUser?.content?.some(
            part =>
              part.text?.startsWith('<hook_prompt ') &&
              part.text.includes('terminal-handoff/v1 correction'),
          ),
        'Unexpected model request after the scripted final answer',
      );
      active.corrected = true;
      return { index, item: responseItem(index, correctionReply, false), delta: correctionReply };
    }
    if (active.command && !active.toolCall) {
      const item = responseItem(index, active.command, true);
      active.toolCall = item.call_id;
      return { index, item };
    }
    if (active.toolCall)
      assert.ok(
        input.some(
          row => row.type === 'custom_tool_call_output' && row.call_id === active.toolCall,
        ),
        'Native command output missing from the model request',
      );
    active.answered = true;
    return { index, item: responseItem(index, active.answer, false), delta: active.answer };
  }

  private writeResponse(response: ServerResponse, input: ModelInput[]): void {
    const { index, item, delta } = this.selectResponse(input);
    const result = { id: `resp_${index}`, object: 'response', model, output: [item] };
    const initial = {
      ...item,
      ...(delta === undefined ? { input: '' } : { content: [] }),
      status: 'in_progress',
    };
    const events: [string, object][] = [
      ['response.created', { response: { ...result, status: 'in_progress', output: [] } }],
      ['response.output_item.added', { item: initial, output_index: 0 }],
      ['response.output_item.done', { item, output_index: 0 }],
      ['response.completed', { response: { ...result, status: 'completed' } }],
    ];
    if (delta !== undefined)
      events.splice(2, 0, [
        'response.output_text.delta',
        { item_id: item.id, output_index: 0, content_index: 0, delta },
      ]);
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const [sequence_number, [type, fields]] of events.entries()) {
      response.write(
        `event: ${type}\ndata: ${JSON.stringify({ type, sequence_number, ...fields })}\n\n`,
      );
    }
    response.end();
  }

  private send(message: object): void {
    assert.ok(this.process);
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private async receive(): Promise<NativeMessage> {
    const result = await this.rows?.next();
    assert.ok(result && !result.done, 'Scripted Codex app-server stopped producing events');
    appendFileSync(nodePath.join(this.directory, 'app-server.jsonl'), `${result.value}\n`);
    const row = JSON.parse(result.value) as NativeMessage;
    assert.ok(!row.method || row.id === undefined, `Unexpected native prompt: ${row.method}`);
    return row;
  }

  private async request(
    method: string,
    params: object,
  ): Promise<NonNullable<NativeMessage['result']>> {
    const id = ++this.nextRequest;
    this.send({ id, method, params });
    let reply = await this.receive();
    while (reply.id !== id) reply = await this.receive();
    assert.ok(reply.result, `Native ${method} failed: ${JSON.stringify(reply.error)}`);
    return reply.result;
  }

  private async start(args: string[]): Promise<void> {
    const reviewed = args.length > 0;
    if (reviewed) assert.deepEqual(args, ['--dangerously-bypass-hook-trust']);
    const ready = once(this.server, 'listening');
    this.server.listen(0, '127.0.0.1');
    await ready;
    const address = this.server.address();
    assert.ok(address && typeof address === 'object');
    const provider = 'model_providers.safeword_test';
    const environment = { ...this.environment };
    delete environment.CODEX_THREAD_ID;
    this.process = spawn(
      this.fixture.binary,
      [
        '-c',
        'model_provider="safeword_test"',
        '-c',
        `${provider}.name="Safeword Test"`,
        '-c',
        `${provider}.base_url="http://127.0.0.1:${address.port}/v1"`,
        '-c',
        `${provider}.wire_api="responses"`,
        '-c',
        `${provider}.requires_openai_auth=false`,
        '--enable',
        'hooks',
        '--enable',
        'plugins',
        'app-server',
        '--stdio',
      ],
      { cwd: this.fixture.project, env: environment, stdio: 'pipe' },
    );
    this.process.stderr.on('data', chunk => {
      appendFileSync(nodePath.join(this.directory, 'app-server-stderr.log'), chunk);
    });
    this.process.on('error', error => {
      appendFileSync(nodePath.join(this.directory, 'app-server-stderr.log'), `${error.message}\n`);
    });
    this.process.stdin.on('error', () => this.process?.kill());
    this.rows = createInterface({ input: this.process.stdout })[Symbol.asyncIterator]();
    await this.request('initialize', {
      clientInfo: { name: 'safeword_handoff_control', version: '1.0.0' },
      capabilities: { experimentalApi: true },
    });
    this.send({ method: 'initialized', params: {} });
    const { thread } = await this.request('thread/start', {
      cwd: this.fixture.project,
      model,
      sandbox: 'workspace-write',
      approvalPolicy: 'never',
      // Match the exec client's thread-scoped override for the independently reviewed fixture.
      ...(reviewed && { config: { bypass_hook_trust: true } }),
    });
    assert.ok(thread?.id);
    this.thread = thread.id;
    this.launchArguments = args;
  }

  private async collectTurn(id: string, events: Event[]): Promise<void> {
    for (;;) {
      const row = await this.receive();
      const item = row.params?.item;
      if (row.method === 'item/completed' && item) {
        const event = completedItem(item);
        if (event) events.push(event);
      }
      const completed = row.params?.turn;
      if (row.method === 'turn/completed' && completed?.id === id) {
        assert.equal(completed.status, 'completed', JSON.stringify(completed.error));
        return;
      }
    }
  }

  async turn(args: string[], prompt: string, command: string, answer: string): Promise<Event[]> {
    assert.ok(!this.active, 'Scripted turns must run sequentially');
    this.active = { command, answer, answered: false, corrected: false };
    const deadline = setTimeout(() => {
      this.close();
    }, 180_000);
    try {
      const events: Event[] = [];
      if (this.thread) {
        assert.deepEqual(args, this.launchArguments, 'Reviewed Codex launch arguments changed');
      } else {
        await this.start(args);
        events.push({ type: 'thread.started', thread_id: this.thread });
      }
      const { turn } = await this.request('turn/start', {
        threadId: this.thread,
        input: [{ type: 'text', text: prompt, text_elements: [] }],
      });
      assert.ok(turn?.id);
      await this.collectTurn(turn.id, events);
      assert.ok(this.active.answered, 'Scripted Codex turn omitted its answer');
      return [...events, { type: 'turn.completed' }];
    } finally {
      clearTimeout(deadline);
      this.active = undefined;
    }
  }

  close(): void {
    this.process?.kill();
    this.server.close();
    this.server.closeAllConnections();
  }
}
