import { describe, expect, it } from 'vitest';

import {
  assertCodexStopSequence,
  reportsMissingVerification,
  type StopObservation,
} from '../helpers/codex-native-continuation.js';

describe('native Codex missing-verification response', () => {
  it.each([
    'Cannot comply: no verification evidence was generated.',
    'Cannot finish: no valid `verify.md` found.',
    'Verification evidence has not been generated.',
    'Missing required verify.md; completion remains blocked.',
    'The verification evidence is missing.',
    'The unmet verification requirement prevents completion.',
    'Unable to satisfy the verification requirement without changing files.',
    'Unable to run verification: the prior instruction required no tools and no file changes.',
  ])('accepts an actual missing-evidence explanation: %s', text => {
    expect(reportsMissingVerification(text)).toBe(true);
  });

  it.each([
    '',
    'FINISHED',
    'Verification evidence is complete.',
    'No verification issues remain.',
    'No verification evidence is missing.',
    'There is no missing verification evidence.',
    'The verification evidence is not missing.',
    'verify.md exists and all checks passed.',
    'Cannot comply: network unavailable.',
    'I am not unable to satisfy the verification requirement.',
  ])('rejects completion or an unrelated failure: %s', text => {
    expect(reportsMissingVerification(text)).toBe(false);
  });
});

describe('native Codex continuation failure classification', () => {
  const stop = (stdout: string, status = 0, active = false): StopObservation => ({
    args: [],
    input: { session_id: 'synthetic', cwd: '/fixture', stop_hook_active: active },
    stdout,
    status,
  });
  const block = JSON.stringify({ decision: 'block', reason: 'Missing verify.md' });

  it.each([
    { name: 'no native Stop', observations: [] },
    { name: 'quiet Stop', observations: [stop('{}')] },
    { name: 'failed quiet Stop', observations: [stop('{}', 1)] },
    { name: 'failed block', observations: [stop(block, 1)] },
    { name: 'consumed capacity', observations: [stop(block, 0, true)] },
    {
      name: 'unrelated block',
      observations: [stop('{"decision":"block","reason":"Other policy"}')],
    },
    { name: 'failed second Stop', observations: [stop(block), stop('{}', 1, true)] },
  ])('does not classify unavailable setup as missing host behavior: $name', ({ observations }) => {
    let caught: unknown;
    try {
      assertCodexStopSequence(observations);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).not.toMatch(
      /HOST_CONTINUATION_MISSING|CONTINUATION_BOUND_EXCEEDED/u,
    );
  });

  it('names a genuine blocked stop with no automatic continuation', () => {
    expect(() => {
      assertCodexStopSequence([stop(block)]);
    }).toThrow('HOST_CONTINUATION_MISSING');
  });

  it('names a genuine continuation beyond the configured bound', () => {
    expect(() => {
      assertCodexStopSequence([stop(block), stop('{}', 0, true), stop('{}', 0, true)]);
    }).toThrow('CONTINUATION_BOUND_EXCEEDED');
  });

  it('accepts exactly one successful automatic continuation', () => {
    expect(() => {
      assertCodexStopSequence([stop(block), stop('{}', 0, true)]);
    }).not.toThrow();
  });
});
