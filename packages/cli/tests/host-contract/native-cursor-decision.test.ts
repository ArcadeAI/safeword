import { describe, expect, it } from 'vitest';

import { nativeCandidateDecisions } from '../helpers/cursor-native-write.js';

const candidate = '/tmp/owned-candidate';
const command = 'printf %s sentinel > allowed-sentinel.txt';

// Sanitized native Hooks output shape, including the complete-record boundary.
function record(origin = candidate, action = command, event = 'preToolUse', exit = 0): string {
  return [
    `Command: bun "${origin}/runtime/cli.js" hook cursor pre-tool-use (23ms) exit code: ${exit}`,
    '',
    'INPUT:',
    JSON.stringify({ hook_event_name: event, tool_input: { command: action } }),
    '',
    'OUTPUT:',
    '{"permission":"allow"}',
    '════════════════',
    '',
  ].join('\n');
}

describe('native Cursor candidate decision observations', () => {
  it('accepts a completed candidate allow for the actual pre-action command', () => {
    expect(nativeCandidateDecisions(record(), candidate, command)).toEqual([
      { permission: 'allow' },
    ]);
  });

  it.each([
    ['foreign hook', record('/tmp/another-plugin')],
    ['different command', record(candidate, 'cat README.md')],
    ['after-the-fact event', record(candidate, command, 'postToolUse')],
    ['failed hook', record(candidate, command, 'preToolUse', 1)],
    ['incomplete output', record().slice(0, record().lastIndexOf('════════'))],
  ])('rejects a %s as evidence of candidate permission', (_name, log) => {
    expect(nativeCandidateDecisions(log, candidate, command)).toEqual([]);
  });

  it('does not combine candidate origin and the right action from separate executions', () => {
    const log = record(candidate, 'cat README.md') + record('/tmp/another-plugin', command);
    expect(nativeCandidateDecisions(log, candidate, command)).toEqual([]);
  });
});
