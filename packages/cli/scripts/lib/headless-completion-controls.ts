import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { reportsMissingVerification } from '../../tests/helpers/codex-native-continuation.js';

interface CompletionEvent {
  type: string;
  subtype?: string;
  is_error?: boolean;
  session_id?: string;
  thread_id?: string;
  item?: { type: string; text?: string };
  message?: { content?: { type: string; text?: string }[] };
}

function codexReplies(events: CompletionEvent[]) {
  return events
    .filter(event => event.type === 'item.completed' && event.item?.type === 'agent_message')
    .map(event => event.item?.text);
}

function claudeReplies(events: CompletionEvent[]) {
  return events
    .filter(event => event.type === 'assistant')
    .flatMap(event => event.message?.content ?? [])
    .filter(part => part.type === 'text')
    .map(part => part.text);
}

export function assertHeadlessContinuation(agent: 'codex' | 'claude', raw: string): void {
  const { stops, events } = JSON.parse(raw) as {
    stops: { input: { session_id: string; stop_hook_active: boolean }; stdout: string }[];
    events: CompletionEvent[];
  };
  const [initial, followup] = stops;
  assert.equal(stops.length, 2, `${agent}: expected exactly one continuation`);
  assert.ok(initial?.input.session_id && followup);
  const session = initial.input.session_id;
  assert.equal(followup.input.session_id, session);
  assert.deepEqual(
    stops.map(stop => stop.input.stop_hook_active),
    [false, true],
  );
  const [initialDecision, lastDecision] = stops.map(stop => JSON.parse(stop.stdout));
  assert.match(initialDecision.reason, /verify\.md/u);
  assert.equal(initialDecision.decision, 'block');

  const messages = agent === 'codex' ? codexReplies(events) : claudeReplies(events);
  assert.equal(messages.length, 2, `${agent}: expected two public replies`);
  assert.ok(reportsMissingVerification(messages[1] ?? ''), `${agent}: expected unmet verification`);
  assertTerminal(agent, events, session, lastDecision);
}

function assertTerminal(
  agent: 'codex' | 'claude',
  events: CompletionEvent[],
  session: string,
  lastDecision: { decision?: string; reason: string },
): void {
  const terminal = events.at(-1);
  if (agent === 'codex') {
    assert.deepEqual(lastDecision, {});
    assert.equal(events[0]?.thread_id, session);
    assert.equal(terminal?.type, 'turn.completed');
    assert.equal(events.filter(event => event.type === 'turn.completed').length, 1);
  } else {
    assert.equal(lastDecision.decision, 'block');
    assert.match(lastDecision.reason, /verify\.md/u);
    assert.equal(terminal?.session_id, session);
    assert.equal(terminal?.type, 'result');
    assert.equal(terminal?.subtype, 'error_max_turns');
    assert.equal(terminal?.is_error, true);
  }
}

export function runOriginalAuthorControl(repoRoot: string, report: string): void {
  const control = 'blocks under cross-model when the author model is unknown (fails closed)';
  const result = spawnSync(
    nodePath.join(repoRoot, 'scripts/dev'),
    [
      'bun',
      'run',
      '--cwd',
      'packages/cli',
      'test',
      'tests/integration/architecture-review-gate.test.ts',
      '--testNamePattern',
      'blocks under cross-model when the author model is unknown',
      '--reporter=json',
      `--outputFile=${report}`,
    ],
    { cwd: repoRoot, stdio: 'inherit', timeout: 120_000 },
  );
  assert.equal(result.status, 0, 'Original-author fail-closed control did not pass');
  const output = JSON.parse(readFileSync(report, 'utf8')) as {
    numPassedTests: number;
    numFailedTests: number;
    testResults: { assertionResults: { title: string; status: string }[] }[];
  };
  const passed = output.testResults
    .flatMap(file => file.assertionResults)
    .filter(test => test.status === 'passed');
  assert.equal(output.numPassedTests, 1);
  assert.equal(output.numFailedTests, 0);
  assert.deepEqual(
    passed.map(test => test.title),
    [control],
  );
}
