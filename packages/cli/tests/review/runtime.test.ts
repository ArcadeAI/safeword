import { describe, expect, it } from 'vitest';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { parseReviewerOutput, reviewTimeoutMilliseconds } from '../../src/review/runtime.js';

const output: ReviewerOutput = {
  schema_version: 1,
  dispatch_id: 'dispatch-1',
  reviewer_agent: 'claude',
  verdict: 'approve',
  summary: 'reviewed',
  findings: [],
};

describe('headless reviewer timeout budgets', () => {
  it.each(['claude', 'codex'] as const)('gives %s a five-minute default budget', reviewer => {
    expect(reviewTimeoutMilliseconds(reviewer, {})).toBe(300_000);
  });

  it.each(['claude', 'codex'] as const)('honors the explicit timeout override for %s', reviewer => {
    expect(reviewTimeoutMilliseconds(reviewer, { SAFEWORD_REVIEW_TIMEOUT_MS: '45000' })).toBe(
      45_000,
    );
  });
});

describe('headless reviewer output adapters', () => {
  it('extracts a review result from the Claude JSON envelope', () => {
    const result = JSON.stringify(output);
    const envelope = JSON.stringify({ type: 'result', subtype: 'success', result });

    expect(parseReviewerOutput('claude', envelope)).toEqual(output);
  });

  it('extracts Claude native structured output without trusting prose formatting', () => {
    const envelope = JSON.stringify({
      type: 'result',
      subtype: 'success',
      result: '```json\nnot trusted\n```',
      structured_output: output,
    });

    expect(parseReviewerOutput('claude', envelope)).toEqual(output);
  });

  it('extracts the last agent message from Codex JSONL events', () => {
    const codexOutput = { ...output, reviewer_agent: 'codex' as const };
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }),
      'non-json diagnostic noise',
      JSON.stringify({
        type: 'item.completed',
        item: {
          id: 'item-0',
          type: 'agent_message',
          text: JSON.stringify({ ...codexOutput, summary: 'superseded' }),
        },
      }),
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item-1', type: 'agent_message', text: JSON.stringify(codexOutput) },
      }),
      JSON.stringify({ type: 'turn.completed' }),
    ].join('\n');

    expect(parseReviewerOutput('codex', stdout)).toEqual(codexOutput);
  });

  it('retains the direct JSON test adapter contract', () => {
    expect(parseReviewerOutput('claude', JSON.stringify(output))).toEqual(output);
  });

  it.each([
    ['wrong schema version', { ...output, schema_version: 2 }],
    ['unknown verdict', { ...output, verdict: 'looks-good' }],
    ['missing summary', { ...output, summary: undefined }],
    ['non-array findings', { ...output, findings: 'none' }],
    ['malformed finding', { ...output, findings: [{ severity: 'critical', message: 'bad' }] }],
    ['extra output property', { ...output, unexpected: true }],
    [
      'extra finding property',
      { ...output, findings: [{ severity: 'info', message: 'noted', unexpected: true }] },
    ],
  ])('rejects structurally invalid output: %s', (_label, invalidOutput) => {
    expect(() => parseReviewerOutput('claude', JSON.stringify(invalidOutput))).toThrow(
      'invalid reviewer output',
    );
  });
});
