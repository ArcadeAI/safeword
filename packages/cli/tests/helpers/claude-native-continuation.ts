import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { getStateFilePath } from '../../templates/hooks/lib/quality-state.js';
import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import { ClaudeNativeContractActor, type ClaudeNativeFixture } from './claude-native-contract.js';

/** Observe real Stop rejection and another model response in one bounded CLI invocation. */
export async function proveClaudeNativeContinuation(fixture: ClaudeNativeFixture): Promise<void> {
  const actor = new ClaudeNativeContractActor(fixture);
  await actor.prepare();
  const session = randomUUID();
  const ticketId = randomUUID().slice(0, 6).toUpperCase();
  const ticket = nodePath.join(actor.project, '.project/tickets', `${ticketId}-unfinished`);
  mkdirSync(ticket, { recursive: true });
  writeFileSync(
    nodePath.join(ticket, 'ticket.md'),
    `---\nid: ${ticketId}\ntype: task\nphase: done\nstatus: in_progress\n---\n\n# Verify the synthetic work\n`,
  );
  const identity = resolveRunIdentity({ session_id: session }, { runtime: 'claude' });
  const statePath = getStateFilePath(actor.project, identity);
  mkdirSync(nodePath.dirname(statePath), { recursive: true });
  writeFileSync(
    statePath,
    JSON.stringify({
      activeTicket: ticketId,
      locSinceCommit: 0,
      lastCommitHash: '',
      // eslint-disable-next-line unicorn/no-null -- actual QualityState empty-gate representation
      gate: null,
      recentFailures: [],
      incrementedPatterns: [],
    }),
  );
  const marker = `FINISH_${randomUUID()}`;
  await actor.turn(
    `Reply only ${marker} and end this turn. Use no tools and change no files. If the host automatically supplies a further instruction, report the unmet requirement honestly without changing files.`,
    '',
    'continuation',
    { sessionId: session, maxTurns: 2, allowTurnLimit: true },
  );
  const stops = actor
    .observations()
    .filter(
      row =>
        row.args.includes('Stop') &&
        row.args.some(argument => argument.endsWith('/stop-quality.ts')),
    );
  assert.ok(stops.length >= 2, 'HOST_CONTINUATION_MISSING: expected a subsequent native Stop');
  assert.ok(stops.length <= 2, 'CONTINUATION_BOUND_EXCEEDED');
  for (const [index, stop] of stops.entries()) {
    assert.equal(stop.input.session_id, session);
    assert.equal(realpathSync(stop.input.cwd ?? ''), realpathSync(actor.project));
    assert.equal(stop.input.stop_hook_active, index > 0);
    assert.equal(stop.status, 0);
    const decision = JSON.parse(stop.stdout) as { decision: string; reason: string };
    assert.equal(decision.decision, 'block', 'HOST_CONTINUATION_MISSING');
    assert.match(decision.reason, /verify\.md/u);
  }
  const events = actor.events('continuation');
  const messages = events.filter(
    event =>
      event.type === 'assistant' && event.message?.content?.some(part => part.type === 'text'),
  );
  assert.equal(messages.length, 2, 'HOST_CONTINUATION_MISSING: expected two native responses');
  const text = (event: (typeof messages)[number] | undefined) =>
    event?.message?.content
      ?.filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n') ?? '';
  assert.ok(text(messages[0]).includes(marker), 'HOST_CONTINUATION_MISSING');
  assert.match(text(messages[1]), /verify\.md|verification/iu);
  assert.equal(events.at(-1)?.subtype, 'error_max_turns', 'CONTINUATION_BOUND_EXCEEDED');
  assert.equal(existsSync(nodePath.join(ticket, 'verify.md')), false);
  assert.ok(
    readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8').includes('status: in_progress'),
  );
}
