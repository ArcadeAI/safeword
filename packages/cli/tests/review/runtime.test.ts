import { describe, expect, it } from 'vitest';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { parseReviewerOutput } from '../../src/review/runtime.js';

const output: ReviewerOutput = {
  schema_version: 1,
  dispatch_id: 'dispatch-1',
  reviewer_agent: 'claude',
  verdict: 'approve',
  summary: 'reviewed',
  findings: [],
};

describe('headless reviewer output adapters', () => {
  it('extracts a review result from the Claude JSON envelope', () => {
    const result = JSON.stringify(output);
    const envelope = JSON.stringify({ type: 'result', subtype: 'success', result });

    expect(parseReviewerOutput('claude', envelope)).toEqual(output);
  });

  it('extracts the last agent message from Codex JSONL events', () => {
    const codexOutput = { ...output, reviewer_agent: 'codex' as const };
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }),
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
  ])('rejects structurally invalid output: %s', (_label, invalidOutput) => {
    expect(() => parseReviewerOutput('claude', JSON.stringify(invalidOutput))).toThrow(
      'invalid reviewer output',
    );
  });
});
