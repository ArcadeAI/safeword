import { describe, expect, it } from 'vitest';

import { nativeStopDecisions } from '../helpers/cursor-native-continuation.js';

const candidate = '/tmp/owned-native-package';
const conversation = 'synthetic-native-conversation';

function record(overrides: Record<string, unknown> = {}, origin = candidate, exit = 0): string {
  return [
    `Command: bun "${origin}/runtime/dispatch.js" stop:0 (23ms) exit code: ${exit}`,
    '',
    'INPUT:',
    JSON.stringify({
      hook_event_name: 'stop',
      conversation_id: conversation,
      cursor_version: '3.24.18',
      loop_count: 0,
      status: 'completed',
      ...overrides,
    }),
    '',
    'OUTPUT:',
    JSON.stringify({ followup_message: 'No valid verify.md found' }),
    '════════════════',
    '',
  ].join('\n');
}

describe('native Cursor Stop observations', () => {
  it('retains the actual candidate decision and host continuation identity together', () => {
    const [observed] = nativeStopDecisions(record(), candidate, conversation);
    expect(observed?.followup).toBe('No valid verify.md found');
    expect(observed?.input).toMatchObject({
      conversation_id: conversation,
      loop_count: 0,
      cursor_version: '3.24.18',
    });
  });

  it.each([
    ['foreign hook', record({}, '/tmp/other-package')],
    ['foreign conversation', record({ conversation_id: 'another-conversation' })],
    ['non-Stop event', record({ hook_event_name: 'afterAgentResponse' })],
    ['failed native script', record({}, candidate, 1)],
    ['partial log record', record().split('════════', 1)[0] ?? ''],
  ])('rejects a %s as a completed native Stop decision', (_label, log) => {
    expect(nativeStopDecisions(log, candidate, conversation)).toEqual([]);
  });

  it('does not combine package origin and conversation identity across records', () => {
    const log =
      record({ conversation_id: 'another-conversation' }) + record({}, '/tmp/other-package');
    expect(nativeStopDecisions(log, candidate, conversation)).toEqual([]);
  });
});
