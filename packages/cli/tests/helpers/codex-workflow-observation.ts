import assert from 'node:assert/strict';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { matchedReads } from '../../scripts/check-codex-internal-reference.js';
import { validatedResourceRevision } from '../../src/codex-plugin/resource-revision.js';
import { TESTING_CORE_LAYOUT } from '../../src/schema-layouts.js';
import { completeResourceSegments, resourceReadPosition } from './codex-resource-segments.js';
import { correlatedToolCommands } from './codex-review-receipt.js';

export type Rollout = Parameters<typeof matchedReads>[0];
export interface NativeTurn {
  thread: string;
  rollout: string;
  entries: Rollout;
  allEntries: Rollout;
  events: {
    type: string;
    item?: { type?: string; command?: string; exit_code?: number; aggregated_output?: string };
  }[];
  models: string[];
}

/** Read a completed actual turn; resumed observations exclude all earlier history. */
export function nativeTurn(
  profile: string,
  stdout: string,
  offset = 0,
  thread?: string,
): NativeTurn {
  const events = stdout
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as NativeTurn['events'][number] & { thread_id?: string });
  assert.ok(
    events.some(event => event.type === 'turn.completed') &&
      events.every(event => event.type !== 'turn.failed' && event.type !== 'error'),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: incomplete native turn',
  );
  const observed = events.find(event => event.type === 'thread.started')?.thread_id;
  assert.ok(
    observed && /^[\da-f-]{36}$/u.test(observed),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: native thread identity',
  );
  if (thread)
    assert.equal(observed, thread, 'HOST_CONTRACT_PROOF_UNAVAILABLE: resumed a different thread');
  const sessions = nodePath.join(profile, 'sessions');
  const files = readdirSync(sessions, { recursive: true, encoding: 'utf8' }).filter(file =>
    file.endsWith(`-${observed}.jsonl`),
  );
  assert.equal(files.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous rollout');
  const rollout = nodePath.join(sessions, files[0] ?? '');
  const allEntries = readFileSync(rollout, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as Rollout[number]);
  assert.ok(
    allEntries.length > offset,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: no current rollout segment',
  );
  const entries = allEntries.slice(offset);
  const models = entries
    .filter(entry => entry.type === 'turn_context')
    .map(entry => (entry.payload as { model?: string } | undefined)?.model)
    .filter((model): model is string => typeof model === 'string');
  assert.ok(models.length, 'HOST_CONTRACT_PROOF_UNAVAILABLE: observed model metadata absent');
  return { thread: observed, rollout, entries, allEntries, events, models };
}

export function messageText(entry: Rollout[number]): string {
  return entry.payload?.content?.map(part => part.text ?? '').join('\n') ?? '';
}

function currentHookText(message: Rollout[number], turnId: string): string {
  const payload = message.payload;
  const unavailable = 'HOST_CONTRACT_PROOF_UNAVAILABLE: unknown hook context encoding or turn';
  assert.ok(payload?.id && payload.type === 'message', unavailable);
  const metadata = payload.internal_chat_message_metadata_passthrough;
  assert.equal(metadata?.turn_id, turnId, unavailable);
  assert.ok(metadata?.content_item_kinds?.includes('hooks.additional_context'), unavailable);
  assert.ok(
    payload.content?.every(part => part.type === 'input_text' && typeof part.text === 'string'),
    unavailable,
  );
  return messageText(message);
}

/** Pinned native hook-context shape; stdout, echoes and old history are not delivery. */
export function startupEssential(turn: NativeTurn, installed: string, core: string) {
  assert.ok(core.length > 0, 'HOST_CONTRACT_PROOF_UNAVAILABLE: expected core absent');
  for (const template of TESTING_CORE_LAYOUT.templates)
    assert.equal(
      readFileSync(nodePath.join(installed, 'templates', template), 'utf8').split(core).length,
      2,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: current installed core mismatch',
    );
  const revision = validatedResourceRevision(installed, installedIndex(installed));
  const contexts = turn.entries.filter(entry => entry.type === 'turn_context');
  assert.equal(contexts.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous current turn');
  const turnId = contexts[0]?.payload?.turn_id;
  assert.ok(turnId, 'HOST_CONTRACT_PROOF_UNAVAILABLE: current turn identity missing');
  const messages = turn.entries.filter(
    entry =>
      entry.type === 'response_item' &&
      entry.payload?.role === 'developer' &&
      messageText(entry).includes(
        'Safeword internal workflows are available automatically by description.',
      ),
  );
  assert.equal(messages.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: unknown startup context');
  const message = messages[0];
  assert.ok(message);
  const text = currentHookText(message, turnId);
  const entryIndex = turn.entries.indexOf(message);
  const firstTool = turn.entries.findIndex(
    entry => entry.payload?.type === 'function_call' || entry.payload?.type === 'custom_tool_call',
  );
  assert.ok(
    firstTool === -1 || entryIndex < firstTool,
    'INTERNAL_WORKFLOW_UNMET: essential context arrived after task tools',
  );
  assert.ok(
    text.includes(`Resource revision: ${revision}`) && text.split(core).length === 2,
    'INTERNAL_WORKFLOW_UNMET: complete current startup essential content absent',
  );
  return {
    method: 'startup-developer-context',
    entryIndex,
    messageId: message.payload?.id,
    turnId,
    revision,
  };
}

/** Native SDK catalogues may use declared skill-root aliases rather than full paths. */
export function automaticCatalogue(context: string): { name: string; path: string }[] {
  const roots = new Map(
    context.matchAll(/^- `([^`]+)` = `([^`]+)`/gmu).map(match => [match[1], match[2]]),
  );
  return context
    .matchAll(/^- (?:safeword:)?([\w-]+):[^\n]*\(file: ([^)]+)\)/gmu)
    .map(match => {
      const name = match[1] ?? '';
      const path = match[2] ?? '';
      const slash = path.indexOf('/');
      const root = roots.get(path.slice(0, slash));
      return { name, path: root ? nodePath.join(root, path.slice(slash + 1)) : path };
    })
    .toArray();
}

function selectedSkillPrefix(text: string, target: string): string {
  const tag = `<path>${target}</path>`;
  if (!text.includes('<skill>') || !text.includes(tag)) return '';
  let tail = text.slice(text.indexOf(tag) + tag.length).trimStart();
  if (tail.startsWith('<resource_access>'))
    tail = tail.slice(tail.indexOf('</resource_access>') + '</resource_access>'.length).trimStart();
  const end = tail.indexOf('</skill>');
  return end === -1 ? '' : tail.slice(0, end).trim();
}

function hasProcedureContent(prefix: string, body: string, marker: string): boolean {
  const following = body.slice(body.indexOf(marker) + marker.length).replace(/^\s*-->\s*/u, '');
  const paragraph = following
    .replaceAll(/<!--[\s\S]*?-->/gu, '')
    .replaceAll(/^#{1,6}[ \t][^\n]*$/gmu, '')
    .trim()
    .split(/\n\s*\n/u, 1)[0];
  return paragraph !== undefined && paragraph.length > 0 && prefix.includes(paragraph);
}

/** Public SDK bodies may be bounded prefixes; internal reads still require correlated tools. */
type ResourceEvidence = Pick<NativeTurn, 'entries'> &
  Partial<Pick<NativeTurn, 'events'>> & {
    afterEntryIndex?: number;
  };

function resourceEvidence(
  source: Rollout | ResourceEvidence,
): ResourceEvidence & { afterEntryIndex: number } {
  const evidence: ResourceEvidence = Array.isArray(source) ? { entries: source } : source;
  return { ...evidence, afterEntryIndex: evidence.afterEntryIndex ?? -1 };
}

function fullBodyReads(evidence: ResourceEvidence, target: string, marker: string, body: string) {
  const ids = matchedReads(evidence.entries, target, marker, body)
    .filter(
      id => resourceReadPosition(evidence.entries, id).start > (evidence.afterEntryIndex ?? -1),
    )
    .toSorted(
      (left, right) =>
        resourceReadPosition(evidence.entries, left).end -
        resourceReadPosition(evidence.entries, right).end,
    );
  if (!evidence.events) return ids;
  const successful = new Set(
    evidence.events
      .filter(event => event.item?.exit_code === 0 && event.item.aggregated_output?.includes(body))
      .flatMap(event => correlatedToolCommands(evidence, event, body))
      .filter(command => ids.includes(command.callId))
      .map(command => command.callId),
  );
  return ids.filter(id => successful.has(id));
}

function segmentedBody(evidence: ResourceEvidence, target: string, body: string) {
  return evidence.events
    ? completeResourceSegments(
        { entries: evidence.entries, events: evidence.events },
        target,
        body,
        evidence.afterEntryIndex,
      )
    : undefined;
}

export function resourceLoad(
  source: Rollout | ResourceEvidence,
  target: string,
  marker: string,
  nativeSkill = false,
  requiredContent?: string,
) {
  const evidence = resourceEvidence(source);
  const { entries } = evidence;
  assert.ok(
    marker.length > 0 && readFileSync(target, 'utf8').split(marker).length === 2,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: resource marker is not unique',
  );
  if (requiredContent !== undefined)
    assert.ok(
      requiredContent.length > 0 &&
        readFileSync(target, 'utf8').split(requiredContent).length === 2,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: expected essential content is not current and unique',
    );
  // A core or nonce is not the complete procedure claimed by this caller.
  const body = readFileSync(target, 'utf8');
  const candidates = [];
  const ids = fullBodyReads(evidence, target, marker, body);
  if (ids.length > 0)
    candidates.push({
      method: 'correlated-tool-read',
      completeBody: true,
      callIds: ids,
      entryIndex: Math.min(...ids.map(id => resourceReadPosition(entries, id).end)),
    });
  const segments = segmentedBody(evidence, target, body);
  if (segments) candidates.push(segments);
  if (nativeSkill) {
    const contexts = entries
      .slice(evidence.afterEntryIndex + 1)
      .filter(
        entry =>
          entry.type === 'response_item' &&
          entry.payload?.role === 'user' &&
          selectedSkillPrefix(messageText(entry), target).includes(marker) &&
          (requiredContent === undefined ||
            selectedSkillPrefix(messageText(entry), target).includes(requiredContent)) &&
          body.trim().startsWith(selectedSkillPrefix(messageText(entry), target)) &&
          hasProcedureContent(selectedSkillPrefix(messageText(entry), target), body, marker),
      );
    for (const context of contexts) {
      const injected = selectedSkillPrefix(messageText(context), target);
      candidates.push({
        method: 'native-skill-context',
        callIds: [],
        injectedBytes: Buffer.byteLength(injected),
        completeBody: injected === body.trim(),
        entryIndex: entries.indexOf(context),
      });
    }
  }
  // Complete current delivery outranks bounded SDK prefixes; earliest valid point wins.
  const earliest = candidates.toSorted(
    (left, right) =>
      Number(right.completeBody) - Number(left.completeBody) || left.entryIndex - right.entryIndex,
  )[0];
  return earliest ?? missingResource(target, requiredContent);
}

function missingResource(target: string, requiredContent?: string): never {
  assert.fail(
    `INTERNAL_WORKFLOW_UNMET: current ${requiredContent === undefined ? 'resource' : 'essential content'} was not loaded: ${target}`,
  );
}

/** Validate the existing Wiring gate's actual containing-asset reference. */
export function handoffTarget(publicPath: string, internalPath: string) {
  const relative = nodePath.relative(nodePath.dirname(publicPath), internalPath);
  const procedure = readFileSync(publicPath, 'utf8');
  assert.ok(
    procedure.includes(`\`${relative}\` → Wiring Tests`),
    'INTERNAL_WORKFLOW_UNMET: projected Wiring gate reference missing',
  );
  const resolved = realpathSync(nodePath.resolve(nodePath.dirname(publicPath), relative));
  assert.equal(resolved, realpathSync(internalPath));
  return { relative, resolved };
}

interface WorkflowIndex {
  version: number;
  workflows: {
    name: string;
    description: string;
    userInvocable: boolean;
    allowImplicitInvocation: boolean;
    path: string;
    resources: string[];
  }[];
}
export function installedIndex(installed: string): WorkflowIndex {
  const index = JSON.parse(
    readFileSync(nodePath.join(installed, 'resources/workflow-index.json'), 'utf8'),
  ) as WorkflowIndex;
  assert.equal(index.version, 1);
  assert.ok(index.workflows.length);
  return index;
}

/** Full startup population precedes each current internal read; bodies are not metadata. */
export function startupPopulation(
  turn: NativeTurn,
  installed: string,
  privateMarkers: string[],
): string {
  const messages = turn.entries.filter(
    entry => entry.type === 'response_item' && entry.payload?.role === 'developer',
  );
  const context = messages.map(messageText).join('\n');
  assert.ok(
    context.includes('Safeword internal workflows are available automatically by description.'),
    'INTERNAL_WORKFLOW_UNMET: native startup discovery absent',
  );
  for (const workflow of installedIndex(installed).workflows) {
    if (!workflow.userInvocable && workflow.allowImplicitInvocation) {
      assert.ok(
        context.includes(workflow.description) &&
          context.includes(nodePath.join(installed, workflow.path)),
        `INTERNAL_WORKFLOW_UNMET: startup population missing ${workflow.name}`,
      );
    }
  }
  for (const marker of privateMarkers)
    assert.ok(
      !context.includes(marker),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: private body marker preloaded',
    );
  const startupAt = turn.entries.findIndex(entry =>
    messageText(entry).includes(
      'Safeword internal workflows are available automatically by description.',
    ),
  );
  const firstTool = turn.entries.findIndex(
    entry => entry.payload?.type === 'function_call' || entry.payload?.type === 'custom_tool_call',
  );
  assert.ok(
    firstTool === -1 || startupAt < firstTool,
    'INTERNAL_WORKFLOW_UNMET: discovery arrived after execution',
  );
  return context;
}

export function assertNodeTests(turn: NativeTurn): void {
  assert.ok(
    turn.events.some(
      event =>
        event.type === 'item.completed' &&
        event.item?.type === 'command_execution' &&
        event.item.exit_code === 0 &&
        /node\s+--test|npm\s+test/u.test(event.item.command ?? '') &&
        /[#\u{2139}] (?:tests|pass) [1-9]\d*/u.test(event.item.aggregated_output ?? '') &&
        /[#\u{2139}] fail 0\b/u.test(event.item.aggregated_output ?? ''),
    ),
    'INTERNAL_WORKFLOW_UNMET: no successful nonempty Node test execution',
  );
}
