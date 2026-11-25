// Diagnostic only: copied-package initial discovery/read, never production admission.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';

import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { parse } from 'yaml';

import hostReleases from '../src/lifecycle/host-releases.json' with { type: 'json' };
import {
  literalPrefixRead,
  literalRootRead,
  readCommands,
  shellStatements,
} from '../tests/helpers/codex-literal-root-read.js';
import type { CodexGuardFixture } from '../tests/helpers/codex-native-continuation.js';
import { assertMatchingTree } from '../tests/helpers/codex-plugin-package.js';

interface NativeHook {
  eventName: string;
  sourcePath: string;
  enabled: boolean;
  trustStatus: string;
}
interface DiscoveryResponse {
  id?: number;
  error?: unknown;
  result: { data: { hooks: NativeHook[]; errors: unknown[]; warnings: unknown[] }[] };
}

const digest = (file: string): string =>
  createHash('sha256').update(readFileSync(file)).digest('hex');
const json = (file: string, value: unknown): void => {
  writeFileSync(file, JSON.stringify(value, undefined, 2));
};
const metadata = (file: string): Record<string, unknown> => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(readFileSync(file, 'utf8'));
  assert.ok(match, `Missing metadata: ${file}`);
  return parse(match[1] ?? '') as Record<string, unknown>;
};

function inventory(root: string): Record<string, string> {
  const files = readdirSync(root, { recursive: true, withFileTypes: true });
  return Object.fromEntries(
    files
      .filter(file => file.isFile())
      .map(file => {
        const absolute = path.join(file.parentPath, file.name);
        return [path.relative(root, absolute), digest(absolute)];
      }),
  );
}

interface RolloutEntry {
  type: string;
  payload?: {
    id?: string;
    turn_id?: string;
    internal_chat_message_metadata_passthrough?: {
      turn_id?: string;
      content_item_kinds?: string[];
      create_time?: number;
    };
    type?: string;
    role?: string;
    author?: string;
    recipient?: string;
    content?: { type?: string; text?: string }[];
    call_id?: string;
    arguments?: string;
    input?: string;
    output?: unknown;
    tools?: unknown;
  };
}

interface ExecText {
  text: string;
  retained?: { head: string; tail: string };
}

function plainTruncation(text: string): ExecText | undefined {
  const plainNotice =
    /^Warning: truncated output \(original token count: [1-9]\d*\)\nTotal output lines: ([1-9]\d*)\n\n/u.exec(
      text,
    );
  if (plainNotice && Number(plainNotice[1]) > 1) {
    const payload = text.slice(plainNotice[0].length);
    assert.ok(
      !/^\s*[{"]/u.test(payload),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported plain truncation',
    );
    return retainedExecText(payload);
  }
  return undefined;
}

function retainedExecText(text: string): ExecText {
  const parts = text.split(/…[1-9]\d* tokens truncated…/u);
  assert.ok(
    parts.length === 2 && parts[0] && parts[1] && !text.includes('Warning: truncated output'),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported truncation edges',
  );
  return { text, retained: { head: parts[0], tail: parts[1] } };
}

function decodedExecText(text: string): ExecText {
  const plain = plainTruncation(text);
  if (plain) return plain;
  const noticed = text.startsWith('Warning: truncated output');
  if (noticed) {
    const notice =
      /^Warning: truncated output \(original token count: [1-9]\d*\)\nTotal output lines: 1\n\n/u.exec(
        text,
      );
    assert.ok(notice, 'HOST_CONTRACT_PROOF_UNAVAILABLE: unknown truncation notice');
    text = text.slice(notice[0].length);
  }
  assert.ok(
    !/^\s*"\{/u.test(text),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported encoded tool output',
  );
  if (!/^\s*\{\s*"(?:chunk_id|wall_time_seconds)"\s*:/u.test(text)) {
    assert.ok(
      !noticed && (!text.includes('{') || !/"output"\s*:/u.test(text)),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported encoded tool output',
    );
    return { text };
  }
  return decodedExecEnvelope(text, noticed);
}

function decodedExecEnvelope(text: string, noticed: boolean): ExecText {
  let value: { chunk_id?: unknown; exit_code?: unknown; output?: unknown };
  try {
    value = JSON.parse(text);
  } catch {
    assert.fail('HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported encoded tool output');
  }
  assert.ok(
    typeof value?.chunk_id === 'string' &&
      typeof value.exit_code === 'number' &&
      typeof value.output === 'string',
    'HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported encoded tool output',
  );
  return noticed && value.output.includes('tokens truncated')
    ? retainedExecText(value.output)
    : { text: value.output };
}

export function outputText(output: unknown, decode = false): string {
  if (typeof output === 'string') return decode ? decodedExecText(output).text : output;
  assert.ok(Array.isArray(output), 'HOST_CONTRACT_PROOF_UNAVAILABLE: unknown tool output');
  return output
    .map((part: { type?: string; text?: string }) => {
      assert.ok(
        part.type === 'input_text' && typeof part.text === 'string',
        'HOST_CONTRACT_PROOF_UNAVAILABLE: unknown output content',
      );
      return decode ? decodedExecText(part.text).text : part.text;
    })
    .join('\n');
}

/** Complete-resource correlation only; omitted stdout is never reconstructed. */
export function completeExecOutputMatches(output: unknown, sdk: string, body: string): boolean {
  const texts = typeof output === 'string' ? [output] : output;
  assert.ok(Array.isArray(texts), 'HOST_CONTRACT_PROOF_UNAVAILABLE: unknown tool output');
  const decoded = texts.map((part: unknown) => {
    if (typeof part === 'string') return decodedExecText(part);
    assert.ok(
      part &&
        typeof part === 'object' &&
        'type' in part &&
        part.type === 'input_text' &&
        'text' in part &&
        typeof part.text === 'string',
      'HOST_CONTRACT_PROOF_UNAVAILABLE: unknown output content',
    );
    return decodedExecText(part.text);
  });
  const views = decoded.filter(part => part.retained);
  if (views.length === 0)
    return decoded
      .map(part => part.text)
      .join('\n')
      .includes(sdk);
  return views.length === 1 && views.some(view => retainedOutputMatches(view, sdk, body));
}

function retainedOutputMatches(view: ExecText, sdk: string, body: string): boolean {
  if (!view?.retained || !view.text.includes(body)) return false;
  const { head, tail } = view.retained;
  return (
    sdk.includes(body) &&
    !/…[1-9]\d* tokens truncated…/u.test(sdk) &&
    sdk.length > head.length + tail.length &&
    sdk.startsWith(head) &&
    sdk.endsWith(tail)
  );
}

function readInput(
  item: NonNullable<RolloutEntry['payload']>,
  marker: string,
): { input: string; callId: string } {
  const input = item.type === 'function_call' ? item.arguments : item.input;
  assert.ok(
    typeof input === 'string' && typeof item.call_id === 'string' && item.call_id.length > 0,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: malformed tool call',
  );
  assert.ok(
    !input.includes(marker),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: marker supplied as tool input',
  );
  return { input, callId: item.call_id };
}

function readsExactPath(input: string, target: string): boolean {
  if (/\$\(|`/u.test(input)) return literalPrefixRead(input, target);
  if (literalRootRead(input, target)) return true;
  const commands = shellStatements(input);
  return commands.some(command => {
    const read = /^\s*(?:cat|sed|head|readFileSync|readFile|read)\b/u.exec(command);
    if (!read) return false;
    const segments = command.slice(read.index + read[0].length).split(target);
    return segments.some(
      (suffix, index) =>
        index > 0 &&
        /[\s"'`]/u.test((segments[index - 1] ?? '').slice(-1)) &&
        /^(?:$|[\s"'`;&|)])/u.test(suffix),
    );
  });
}

export function existingGrants(config: string): string {
  const hooks = parseToml(config).hooks as { state?: Record<string, unknown> } | undefined;
  assert.ok(hooks?.state, 'HOST_CONTRACT_PROOF_UNAVAILABLE: no existing grants');
  return stringifyToml({ hooks: { state: hooks.state } });
}

export function hasNativeControl(entries: RolloutEntry[]): boolean {
  return entries.some(entry => {
    const item = entry.payload;
    if (entry.type !== 'response_item' || !item?.type?.endsWith('_call_output')) return false;
    return /Process exited with code 0\b|\bexit_code["']?\s*:\s*0\b|# fail 0\b/u.test(
      outputText(item.output),
    );
  });
}

function isToolCall(item: RolloutEntry['payload']): item is NonNullable<RolloutEntry['payload']> {
  return item?.type === 'function_call' || item?.type === 'custom_tool_call';
}

function validateProtocol(items: RolloutEntry['payload'][]): void {
  const known = new Set([
    'message',
    'reasoning',
    'function_call',
    'function_call_output',
    'custom_tool_call',
    'custom_tool_call_output',
  ]);
  assert.ok(
    items.every(
      item =>
        item?.type &&
        (known.has(item.type) ||
          (item.type === 'agent_message' && informationalCallback(item)) ||
          (item.type === 'additional_tools' && informationalTools(item))),
    ),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: unrecognized rollout protocol',
  );
  for (const item of items) {
    if (item?.type !== 'function_call_output' && item?.type !== 'custom_tool_call_output') continue;
    assert.ok(
      !outputText(item.output).includes('sandbox_apply: Operation not permitted'),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native shell sandbox could not start',
    );
  }
}

/** Current declaration metadata only: never a call, output, read or startup message. */
function informationalTools(item: NonNullable<RolloutEntry['payload']>): boolean {
  const invalid = 'HOST_CONTRACT_PROOF_UNAVAILABLE: malformed additional tools';
  function record(value: unknown): asserts value is Record<string, unknown> {
    assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), invalid);
  }
  function keys(value: object, expected: string[]): void {
    assert.deepEqual(
      Object.keys(value).toSorted((left, right) => left.localeCompare(right)),
      expected.toSorted((left, right) => left.localeCompare(right)),
      invalid,
    );
  }
  function named(value: Record<string, unknown>): void {
    assert.ok(typeof value.name === 'string' && /^[A-Za-z_][\w-]*$/u.test(value.name), invalid);
    assert.equal(typeof value.description, 'string', invalid);
  }
  function toolDeclaration(tool: unknown): void {
    record(tool);
    named(tool);
    if (tool.type === 'custom') {
      keys(tool, ['type', 'name', 'description', 'format']);
      record(tool.format);
      keys(tool.format, ['type', 'syntax', 'definition']);
      assert.equal(tool.format.type, 'grammar', invalid);
      assert.equal(tool.format.syntax, 'lark', invalid);
      assert.ok(
        typeof tool.format.definition === 'string' && tool.format.definition.trim().length > 0,
        invalid,
      );
    } else {
      keys(tool, ['type', 'name', 'description', 'strict', 'parameters']);
      assert.equal(tool.type, 'function', invalid);
      assert.equal(tool.strict, false, invalid);
      record(tool.parameters);
      keys(tool.parameters, [
        'type',
        'properties',
        'additionalProperties',
        ...(Object.hasOwn(tool.parameters, 'required') ? ['required'] : []),
      ]);
      assert.equal(tool.parameters.type, 'object', invalid);
      record(tool.parameters.properties);
      const properties = tool.parameters.properties;
      assert.equal(tool.parameters.additionalProperties, false, invalid);
      if (Object.hasOwn(tool.parameters, 'required')) {
        assert.ok(
          Array.isArray(tool.parameters.required) &&
            tool.parameters.required.every(
              name => typeof name === 'string' && Object.hasOwn(properties, name),
            ),
          invalid,
        );
      }
    }
  }
  keys(item, ['type', 'id', 'role', 'tools']);
  assert.match(item.id ?? '', /^at_[\da-f-]{36}$/u, invalid);
  assert.equal(item.role, 'developer', invalid);
  assert.ok(Array.isArray(item.tools) && item.tools.length > 0, invalid);
  for (const namespace of item.tools) {
    record(namespace);
    keys(namespace, ['type', 'name', 'description', 'tools']);
    assert.equal(namespace.type, 'namespace', invalid);
    named(namespace);
    assert.ok(Array.isArray(namespace.tools) && namespace.tools.length > 0, invalid);
    for (const tool of namespace.tools) toolDeclaration(tool);
  }
  return true;
}

/** Pinned informational callback only. It never contributes to any evidence method. */
function informationalCallback(item: NonNullable<RolloutEntry['payload']>): boolean {
  const invalid = 'HOST_CONTRACT_PROOF_UNAVAILABLE: malformed informational callback';
  assert.deepEqual(
    Object.keys(item).toSorted((left, right) => left.localeCompare(right)),
    ['author', 'content', 'id', 'internal_chat_message_metadata_passthrough', 'recipient', 'type'],
    invalid,
  );
  assert.match(item.id ?? '', /^amsg_[\da-f-]{36}$/u, invalid);
  assert.match(item.author ?? '', /^\/root\/[\w-]+$/u, invalid);
  assert.equal(item.recipient, '/root', invalid);
  assert.ok(Array.isArray(item.content) && item.content.length === 1, invalid);
  const part = item.content[0];
  assert.ok(part && typeof part.text === 'string' && part.text.length > 0, invalid);
  assert.deepEqual(
    Object.keys(part).toSorted((left, right) => left.localeCompare(right)),
    ['text', 'type'],
    invalid,
  );
  assert.equal(part.type, 'input_text', invalid);
  const callbackMetadata = item.internal_chat_message_metadata_passthrough;
  assert.ok(callbackMetadata, invalid);
  assert.match(callbackMetadata.turn_id ?? '', /^[\da-f-]{36}$/u, invalid);
  assert.ok(
    typeof callbackMetadata.create_time === 'number' &&
      Number.isFinite(callbackMetadata.create_time) &&
      callbackMetadata.create_time > 0,
    invalid,
  );
  assert.deepEqual(
    Object.keys(callbackMetadata).toSorted((left, right) => left.localeCompare(right)),
    ['create_time', 'turn_id'],
    invalid,
  );
  return true;
}

export function matchedReads(
  entries: RolloutEntry[],
  target: string,
  marker: string,
  requiredContent?: string,
): string[] {
  const items = entries.filter(entry => entry.type === 'response_item').map(entry => entry.payload);
  validateProtocol(items);
  const matches: string[] = [];
  for (const candidate of items) {
    if (!isToolOutput(candidate)) continue;
    if (
      !outputText(candidate.output).includes(marker) &&
      items.every(
        item => !(item?.call_id === candidate.call_id && literalTargetCandidate(item, target)),
      )
    )
      continue;
    const { input, callId, raw } = markedReadCall(items, candidate, marker);
    // Decode command syntax only for output carrying the current resource marker.
    if (readCommands(input).every(command => !readsExactPath(command, target))) continue;
    const output = outputText(raw, requiredContent !== undefined);
    if (
      output.includes(marker) &&
      (requiredContent === undefined || output.includes(requiredContent))
    )
      matches.push(callId);
  }
  return matches;
}

function isToolOutput(item: RolloutEntry['payload']): item is NonNullable<RolloutEntry['payload']> {
  return item?.type === 'function_call_output' || item?.type === 'custom_tool_call_output';
}

function literalTargetCandidate(item: RolloutEntry['payload'], target: string): boolean {
  if (!isToolCall(item)) return false;
  const input = item.type === 'function_call' ? item.arguments : item.input;
  return typeof input === 'string' && input.includes(target);
}

function markedReadCall(
  items: RolloutEntry['payload'][],
  candidate: NonNullable<RolloutEntry['payload']>,
  marker: string,
) {
  const kind = candidate.type === 'function_call_output' ? 'function_call' : 'custom_tool_call';
  const calls = items.filter(item => item?.type === kind && item.call_id === candidate.call_id);
  assert.equal(
    calls.length,
    1,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: missing/ambiguous correlated tool output',
  );
  const item = calls[0];
  assert.ok(isToolCall(item), 'HOST_CONTRACT_PROOF_UNAVAILABLE: malformed tool call');
  const { input, callId } = readInput(item, marker);
  const outputs = items.filter(
    output => output?.type === candidate.type && output?.call_id === callId,
  );
  assert.equal(
    outputs.length,
    1,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: missing/ambiguous correlated tool output',
  );
  return { input, callId, raw: outputs[0]?.output };
}

function observe(artifacts: string, destination: string): number {
  const identity = JSON.parse(readFileSync(path.join(artifacts, 'identity.json'), 'utf8')) as {
    profile: string;
    marker: string;
    internal: { eligible: boolean; description: string; relative: string }[];
  };
  const { profile, marker, internal } = identity;
  const output = readFileSync(path.join(artifacts, 'trial.stdout'), 'utf8');
  const events = output
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
  assert.ok(
    events.some(event => event.type === 'turn.completed') &&
      events.every(event => event.type !== 'turn.failed'),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: incomplete native turn',
  );
  const thread = events.find(event => event.type === 'thread.started')?.thread_id;
  assert.ok(typeof thread === 'string' && /^[\da-f-]{36}$/u.test(thread));
  const sessions = path.join(profile, 'sessions');
  assert.ok(realpathSync(profile).startsWith(`${realpathSync(artifacts)}/`));
  const rollouts = readdirSync(sessions, { recursive: true, encoding: 'utf8' }).filter(file =>
    file.endsWith(`-${thread}.jsonl`),
  );
  assert.equal(rollouts.length, 1);
  const rollout = path.join(sessions, rollouts[0] ?? '');
  const entries = readFileSync(rollout, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as RolloutEntry);
  const contexts = entries
    .filter(entry => entry.type === 'response_item' && entry.payload?.role === 'developer')
    .flatMap(entry => entry.payload?.content?.map(part => part.text ?? '') ?? []);
  const context = contexts.join('\n');
  const startup = contexts.find(text =>
    text.includes('Internal workflow references (load when their description applies):'),
  );
  assert.ok(startup, 'HOST_CONTRACT_PROOF_UNAVAILABLE: startup absent');
  const installed = realpathSync(
    path.join(profile, 'plugins/cache/safeword-contract-test/safeword/1.2.0'),
  );
  const eligible = internal.filter(entry => entry.eligible);
  assert.ok(eligible.length > 0);
  for (const entry of eligible) {
    assert.ok(
      startup.includes(entry.description) && startup.includes(path.join(installed, entry.relative)),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: startup metadata missing/truncated',
    );
  }
  assert.ok(!context.includes(marker), 'HOST_CONTRACT_PROOF_UNAVAILABLE: marker preloaded');
  const target = path.join(installed, 'internal/testing/SKILL.md');
  const body = readFileSync(target, 'utf8');
  assert.equal(
    body.split(marker).length,
    2,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: marker not unique in testing body',
  );
  const callIds = matchedReads(entries, target, marker);
  assert.ok(
    callIds.length > 0 || hasNativeControl(entries),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: no positive native execution control',
  );
  writeFileSync(path.join(destination, 'developer-context.txt'), context);
  json(path.join(destination, 'result.json'), {
    status: callIds.length > 0 ? 'initial-reference-read-passed' : 'INTERNAL_REFERENCE_NOT_REACHED',
    rollout,
    callIds,
    startupContextBytes: Buffer.byteLength(startup),
    totalDeveloperContextBytes: Buffer.byteLength(context),
    menu: 'separate actual TUI observation required',
    limits:
      'No resumed selection, public handoff, guarded procedure authority, other-host support, production wiring or ticket completion is established.',
  });
  return callIds.length > 0 ? 0 : 2;
}

function replay(artifacts: string): number {
  const root = realpathSync(artifacts);
  const owned = path.dirname(root);
  assert.ok(
    owned.startsWith(`${realpathSync('/tmp')}/`) &&
      path.basename(owned).startsWith('codex-guard-') &&
      path.basename(root).startsWith('internal-reference-'),
  );
  const destination = mkdtempSync(path.join(root, 'replay-'));
  try {
    const status = observe(root, destination);
    console.log(
      JSON.stringify({ status, artifacts: destination, sourceArtifacts: root, modelCalls: 0 }),
    );
    return status;
  } catch (error) {
    json(path.join(destination, 'unavailable.json'), {
      status: 'unavailable',
      message: String(error),
    });
    console.error(String(error));
    return 3;
  }
}

async function discovery(
  binary: string,
  profile: string,
  project: string,
  method: string,
): Promise<DiscoveryResponse> {
  const child = spawn(
    binary,
    ['--enable', 'hooks', '--enable', 'plugins', 'app-server', '--stdio'],
    {
      cwd: project,
      env: { ...process.env, CODEX_HOME: profile },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  child.stderr.resume();
  const timer = setTimeout(() => child.kill(), 30_000);
  const send = (value: unknown): void => {
    child.stdin.write(`${JSON.stringify(value)}\n`);
  };
  try {
    send({
      id: 1,
      method: 'initialize',
      params: {
        clientInfo: { name: 'internal_reference_pilot', version: '0.0.1' },
        capabilities: { experimentalApi: true },
      },
    });
    const lines = createInterface({ input: child.stdout });
    for await (const line of lines) {
      const response = JSON.parse(line) as DiscoveryResponse;
      assert.equal(
        response.error,
        undefined,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: native discovery error',
      );
      if (response.id === 1) {
        send({ method: 'initialized', params: {} });
        send({ id: 2, method, params: { cwds: [project] } });
      } else if (response.id === 2) return response;
    }
    throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: discovery incomplete');
  } finally {
    clearTimeout(timer);
    child.stdin.end();
    child.kill();
  }
}

// This diagnostic keeps its setup, observation and preservation checks in execution order.

async function finish(
  status: number,
  artifacts: string,
  preservation?: () => Promise<void>,
): Promise<number> {
  try {
    await preservation?.();
  } catch (error) {
    json(path.join(artifacts, 'result.json'), {
      status: 'unavailable',
      reason: 'preservation failed',
      message: String(error),
    });
    console.error(`HOST_CONTRACT_PROOF_UNAVAILABLE: preservation failed: ${String(error)}`);
    return 3;
  }
  console.log(JSON.stringify({ status, artifacts }));
  return status;
}

async function main(): Promise<number> {
  let artifacts = '';
  let preservation: (() => Promise<void>) | undefined;
  try {
    const fixtureFile = process.argv[2] ?? process.env.SAFEWORD_CODEX_GUARD_FIXTURE;
    assert.ok(fixtureFile, 'Supply the owned SAFEWORD_CODEX_GUARD_FIXTURE');
    const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8')) as CodexGuardFixture & {
      hookManifestSha256: string;
    };
    const owned = realpathSync(fixture.root);
    const temporaryRoot = realpathSync('/tmp');
    assert.ok(
      owned.startsWith(`${temporaryRoot}/`) && path.basename(owned).startsWith('codex-guard-'),
    );
    assert.equal(realpathSync(fixture.profile), path.join(owned, 'profile'));
    assert.ok(realpathSync(fixture.installedPath).startsWith(`${owned}/profile/plugins/cache/`));
    const source = path.resolve(import.meta.dirname, '../codex-plugin');
    assertMatchingTree(source, fixture.installedPath);
    const originalConfig = readFileSync(path.join(fixture.profile, 'config.toml'), 'utf8');
    const originalManifest = digest(path.join(fixture.installedPath, 'hooks.json'));
    assert.equal(originalManifest, fixture.hookManifestSha256);
    artifacts = mkdtempSync(path.join(owned, 'internal-reference-'));
    console.log(`Pilot artifacts: ${artifacts}`);
    const profile = path.join(artifacts, 'profile');
    const project = path.join(artifacts, 'project');
    const marketplace = path.join(artifacts, 'marketplace');
    const candidate = path.join(marketplace, 'plugin');
    mkdirSync(profile);
    mkdirSync(project);
    mkdirSync(marketplace);
    cpSync(source, candidate, { recursive: true });
    // Copy only existing grants, never project hook definitions or newly computed hashes.
    const grants = existingGrants(originalConfig);
    writeFileSync(path.join(profile, 'config.toml'), grants);
    copyFileSync(path.join(fixture.profile, 'auth.json'), path.join(profile, 'auth.json'));
    chmodSync(path.join(profile, 'auth.json'), 0o600);
    const env: NodeJS.ProcessEnv = { ...process.env, CODEX_HOME: profile };
    delete env.SAFEWORD_CLI;
    function command(args: string[], label: string): string {
      const result = spawnSync(fixture.binary, args, {
        cwd: project,
        env,
        encoding: 'utf8',
        timeout: 240_000,
        maxBuffer: 16 * 1024 * 1024,
      });
      writeFileSync(path.join(artifacts, `${label}.stdout`), result.stdout ?? '');
      writeFileSync(path.join(artifacts, `${label}.stderr`), result.stderr ?? '');
      assert.equal(result.error, undefined, `HOST_CONTRACT_PROOF_UNAVAILABLE: ${label} process`);
      assert.equal(
        result.status,
        0,
        `HOST_CONTRACT_PROOF_UNAVAILABLE: ${label} exit ${result.status}`,
      );
      return result.stdout;
    }
    assert.equal(
      command(['--version'], 'version').trim(),
      `codex-cli ${hostReleases.codex.version}`,
    );
    const internal: { name: string; description: string; eligible: boolean; relative: string }[] =
      [];
    const assetMap: Record<string, string> = {};
    const marker = `internal-reference-${randomUUID()}`;
    const skillNames = readdirSync(path.join(source, 'skills'));
    for (const name of skillNames) {
      const canonical = metadata(
        path.resolve(import.meta.dirname, '../templates/skills', name, 'SKILL.md'),
      );
      if (canonical['user-invocable'] !== false) continue;
      assert.equal(typeof canonical.description, 'string');
      const relative = `internal/${name}/SKILL.md`;
      internal.push({
        name,
        description: canonical.description as string,
        eligible: canonical['disable-model-invocation'] !== true,
        relative,
      });
      mkdirSync(path.join(candidate, 'internal'), { recursive: true });
      renameSync(path.join(candidate, 'skills', name), path.join(candidate, 'internal', name));
      assetMap[`skills/${name}/`] = `internal/${name}/`;
    }
    assert.ok(internal.some(entry => entry.name === 'testing' && entry.eligible));
    const testing = path.join(candidate, 'internal/testing/SKILL.md');
    writeFileSync(
      testing,
      readFileSync(testing, 'utf8').replace(
        '\n# Writing Good Tests',
        () => `\n<!-- ${marker} -->\n\n# Writing Good Tests`,
      ),
    );
    renameSync(
      path.join(candidate, 'runtime/cli.js'),
      path.join(candidate, 'runtime/cli-original.js'),
    );
    // Unmodified hook command/manifest; only successful startup JSON gains metadata.
    writeFileSync(
      path.join(candidate, 'runtime/cli.js'),
      String.raw`import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);
const result=spawnSync(process.execPath,[fileURLToPath(new URL('./cli-original.js',import.meta.url)),...args],{input:readFileSync(0),env:process.env,maxBuffer:16*1024*1024});
if(result.stderr) process.stderr.write(result.stderr);
let output=result.stdout;
if(result.status===0 && args.join(' ')==='hook codex session-start --plugin-hook') {
 const value=JSON.parse(output.toString());
 const entries=${JSON.stringify(internal.filter(entry => entry.eligible))};
 const extra='\n\nInternal workflow references (load when their description applies):\n'+entries.map(entry=>'- '+entry.name+': '+entry.description+' (file: '+fileURLToPath(new URL('../'+entry.relative,import.meta.url))+')').join('\n');
 if(!value.hookSpecificOutput || typeof value.hookSpecificOutput.additionalContext!=='string') throw new Error('No original startup context');
 value.hookSpecificOutput.additionalContext+=extra;
 output=Buffer.from(JSON.stringify(value));
}
if(output) process.stdout.write(output);
if(result.signal) process.kill(process.pid,result.signal); else process.exit(result.status??3);
`,
    );
    mkdirSync(path.join(marketplace, '.agents/plugins'), { recursive: true });
    json(path.join(marketplace, '.agents/plugins/marketplace.json'), {
      name: 'safeword-contract-test',
      owner: { name: 'Safeword isolated fixture' },
      plugins: [
        {
          name: 'safeword',
          source: { source: 'local', path: './plugin' },
          policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
          category: 'Developer Tools',
        },
      ],
    });
    json(path.join(artifacts, 'identity.json'), {
      fixtureFile,
      fixture,
      source,
      runtimeSha256: digest(path.join(source, 'runtime/cli.js')),
      originalManifest,
      binary: realpathSync(fixture.binary),
      model: 'gpt-5.6-terra',
      profile,
      project,
      internal,
      assetMap,
      marker,
    });
    command(['plugin', 'marketplace', 'add', marketplace, '--json'], 'marketplace-add');
    const install = JSON.parse(
      command(['plugin', 'add', 'safeword@safeword-contract-test', '--json'], 'plugin-add'),
    );
    json(path.join(artifacts, 'install.json'), install);
    const installed = path.join(profile, 'plugins/cache/safeword-contract-test/safeword/1.2.0');
    assertMatchingTree(candidate, installed);
    assert.equal(digest(path.join(installed, 'hooks.json')), originalManifest);
    async function hooks(label: string): Promise<NativeHook[]> {
      const response = await discovery(fixture.binary, profile, project, 'hooks/list');
      json(path.join(artifacts, `${label}.json`), response);
      const data = response.result.data[0];
      assert.ok(data);
      assert.deepEqual(data.errors, []);
      assert.deepEqual(data.warnings, []);
      assert.deepEqual(
        data.hooks.map(hook => hook.eventName).toSorted((a, b) => a.localeCompare(b)),
        ['preToolUse', 'postToolUse', 'sessionStart', 'userPromptSubmit', 'stop'].toSorted((a, b) =>
          a.localeCompare(b),
        ),
      );
      for (const hook of data.hooks) {
        assert.equal(hook.trustStatus, 'trusted');
        assert.equal(hook.enabled, true);
        assert.equal(
          realpathSync(hook.sourcePath),
          path.join(realpathSync(installed), 'hooks.json'),
        );
      }
      return data.hooks;
    }
    const before = await hooks('hooks-before');
    preservation = async (): Promise<void> => {
      assert.deepEqual(await hooks('hooks-after'), before);
      assert.equal(readFileSync(path.join(fixture.profile, 'config.toml'), 'utf8'), originalConfig);
      assert.equal(digest(path.join(fixture.installedPath, 'hooks.json')), originalManifest);
      assertMatchingTree(source, fixture.installedPath);
      json(path.join(artifacts, 'preservation.json'), {
        originalConfigUnchanged: true,
        originalBundleUnchanged: true,
        pilotFiveTrustedBindingsUnchanged: true,
      });
    };
    const sourceAssets = inventory(source);
    const candidateAssets = inventory(candidate);
    json(path.join(artifacts, 'assets.json'), {
      source: sourceAssets,
      candidate: candidateAssets,
      assetMap: Object.keys(sourceAssets).map(from => ({
        from,
        to:
          from === 'runtime/cli.js'
            ? 'runtime/cli-original.js'
            : from.replace(/^skills\/(?<name>[^/]+)\//u, (prefix, name: string) =>
                internal.some(entry => entry.name === name) ? `internal/${name}/` : prefix,
              ),
      })),
      sourceDigest: createHash('sha256').update(JSON.stringify(sourceAssets)).digest('hex'),
      candidateDigest: createHash('sha256').update(JSON.stringify(candidateAssets)).digest('hex'),
    });
    json(
      path.join(artifacts, 'skills-list.json'),
      await discovery(fixture.binary, profile, project, 'skills/list'),
    );
    writeFileSync(
      path.join(project, 'package.json'),
      '{"type":"module","scripts":{"test":"node --test"}}\n',
    );
    writeFileSync(
      path.join(project, 'clamp.js'),
      'export function clamp(value, min, max) { if (min > max) throw new RangeError("min exceeds max"); return Math.min(max, Math.max(min, value)); }\n',
    );
    const request =
      'Please write focused tests for the existing clamp function using the built-in Node test runner, run them, and report the results.';
    writeFileSync(path.join(artifacts, 'request.txt'), request);
    command(
      [
        '--enable',
        'hooks',
        '--enable',
        'plugins',
        'exec',
        '--json',
        '--skip-git-repo-check',
        '-s',
        'workspace-write',
        '-c',
        'approval_policy="never"',
        '-m',
        'gpt-5.6-terra',
        request,
      ],
      'trial',
    );
    return await finish(observe(artifacts, artifacts), artifacts, preservation);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (artifacts)
      json(path.join(artifacts, 'unavailable.json'), { status: 'unavailable', message });
    console.error(`HOST_CONTRACT_PROOF_UNAVAILABLE: ${message}`);
    return await finish(3, artifacts, preservation);
  }
}

async function run(): Promise<number> {
  try {
    if (process.argv[2] === '--replay') {
      assert.ok(process.argv[3], 'Supply --replay <owned pilot artifact root>');
      return replay(process.argv[3]);
    }
    return await main();
  } catch (error) {
    console.error(`HOST_CONTRACT_PROOF_UNAVAILABLE: preservation check failed: ${String(error)}`);
    return 3;
  }
}
if (import.meta.main) process.exitCode = await run();
