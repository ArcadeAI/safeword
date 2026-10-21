import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { assertMatchingTree } from './codex-plugin-package.js';
import type { NativeModelRequest } from './opencode-native-driver.js';
import { openCodeScriptedModelFixture } from './opencode-native-driver.js';
import type { OpenCodeNativeFixture } from './opencode-native-write.js';
import { OpenCodeNativeWriteActor } from './opencode-native-write.js';

const bridgeMarker = 'Safeword worker: safeword-reviewer';

function isWorker(request: NativeModelRequest): boolean {
  return (
    request.messages?.some(
      message => message.role === 'user' && JSON.stringify(message.content).includes(bridgeMarker),
    ) === true
  );
}

interface NativeObservation {
  setup?: boolean;
  version?: string;
  prompt?: { text: string };
  session?: { id: string; parentID?: string };
  session_id?: string;
  tool?: string;
  input?: { command?: string; path?: string; agent?: string; sessionID?: string };
  plugins?: { source: { type: string; path?: string }; state: { status: string } }[];
}

/** Real generic delegation, canonical procedure read, and an adversarial tool request. */
export async function proveOpenCodeWorker(fixture: OpenCodeNativeFixture, runtime: 'CLI' | 'TUI') {
  const actor = new OpenCodeNativeWriteActor(fixture);
  await actor.prepare('OpenCode V2', '2.0.32', runtime);
  const parentNonce = `PARENT_ONLY_${randomUUID()}`;
  const packetMarker = `PACKET_${randomUUID()}`;
  let directory = '';
  let candidate = '';
  let target = '';
  let packet = '';
  let procedure = '';
  const requests: NativeModelRequest[] = [];
  const command = 'printf %s FORBIDDEN_WORKER_WRITE > worker-forbidden.txt';
  await actor.runModelFixture(async paths => {
    directory = paths.directory;
    candidate = paths.candidate;
    packet = nodePath.join(paths.project, 'accepted-review-packet.md');
    procedure = nodePath.join(candidate, 'templates/agents/safeword-reviewer.md');
    target = nodePath.join(paths.project, 'worker-forbidden.txt');
    assert.equal(existsSync(target), false);
    assert.match(readFileSync(procedure, 'utf8'), /^tools: Read$/mu);
    writeFileSync(packet, packetMarker);
    const model = await openCodeScriptedModelFixture(directory, request => {
      requests.push(request);
      const results = request.messages?.filter(message => message.role === 'tool') ?? [];
      if (!isWorker(request)) {
        return results.length === 0
          ? {
              tool: {
                name: 'subagent',
                input: {
                  agent: 'general',
                  description: 'Review the accepted packet',
                  prompt: `${bridgeMarker}\nRead ${procedure} and follow it. Accepted review target: ${packet}`,
                },
              },
            }
          : {};
      }
      // Emit the forbidden shell call even when the host omits it from advertised tools.
      if (results.length < 2)
        return {
          tool: { name: 'read', input: { path: results.length === 0 ? procedure : packet } },
        };
      if (results.length === 2) return { tool: { name: 'shell', input: { command } } };
      return { text: 'WORKER_NATIVE_COMPLETE' };
    });
    return { ...model, prompt: `${parentNonce}. Delegate the isolated canonical worker task.` };
  });
  const observations = readFileSync(nodePath.join(directory, 'native-observations.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as NativeObservation);
  assert.ok(observations.some(row => row.setup && row.version === '2.0.32'));
  const child = observations.find(
    row => row.session?.parentID && row.prompt?.text.includes(bridgeMarker),
  );
  assert.ok(child?.session, 'HOST_CONTRACT_PROOF_UNAVAILABLE: native worker child was not created');
  const parent = observations.find(row => row.session?.id === child.session?.parentID);
  assert.ok(parent);
  assert.ok(parent?.prompt?.text.includes(parentNonce));
  assert.notEqual(child.session.id, parent.session?.id);
  const delegation = observations.filter(row => row.tool === 'subagent');
  assert.equal(delegation.length, 1);
  const delegated = delegation[0];
  assert.ok(delegated?.input);
  assert.equal(delegated.input.agent, 'general');
  assert.equal(delegated.input.sessionID, undefined);
  assert.ok(
    delegated.plugins?.some(
      plugin =>
        plugin.source.type === 'local' &&
        plugin.source.path?.startsWith(candidate) &&
        plugin.state.status === 'active',
    ),
  );
  assert.ok(fixture.v2CandidatePackage);
  assertMatchingTree(fixture.v2CandidatePackage, candidate);
  const workerRequests = requests.filter(isWorker);
  assert.ok(
    workerRequests.length >= 4,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: worker did not finish its native tool loop',
  );
  assert.ok(
    workerRequests.every(request => !JSON.stringify(request.messages).includes(parentNonce)),
    'V2_WORKER_CONTEXT_LEAK: parent-only nonce reached child context',
  );
  assert.ok(
    workerRequests.some(request =>
      JSON.stringify(request.messages?.filter(message => message.role === 'tool')).includes(
        packetMarker,
      ),
    ),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: permitted native Read did not return the accepted packet',
  );
  const attempts = observations.filter(
    row =>
      row.session_id === child.session?.id &&
      row.tool === 'shell' &&
      row.input?.command === command,
  );
  assert.equal(
    attempts.length,
    1,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: no unique actual forbidden worker tool attempt',
  );
  const freshId = `opencode-v2-2.0.32-${runtime.toLowerCase()}-worker-fresh-context`;
  console.log(`${freshId}: passed; ${directory}`);
  assert.equal(
    existsSync(target),
    false,
    'V2_WORKER_FORBIDDEN_ACTION: canonical Read-only worker wrote a file through the native shell',
  );
  assert.ok(
    workerRequests.every(request => {
      const names = request.tools?.map(tool => tool.function?.name) ?? [];
      return names.length === 1 && names[0] === 'read';
    }),
    'V2_WORKER_FORBIDDEN_ACTION: native worker exposes authority beyond canonical Read',
  );
  assert.ok(
    requests
      .filter(request => !isWorker(request))
      .every(request => request.tools?.some(tool => tool.function?.name === 'shell')),
    'V2_WORKER_FORBIDDEN_ACTION: worker restriction changed unrelated parent authority',
  );
  assert.ok(
    workerRequests.some(request =>
      JSON.stringify(request.messages).includes('Tool is not available for this request: shell'),
    ),
    'V2_WORKER_FORBIDDEN_ACTION: no native tool restriction result',
  );
  console.log(
    `opencode-v2-2.0.32-${runtime.toLowerCase()}-worker-forbidden-action: passed; ${directory}`,
  );
  return { runtime, directory, fresh_context: true, forbidden_action_blocked: true };
}
