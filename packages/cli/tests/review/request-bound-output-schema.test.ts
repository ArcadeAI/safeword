import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  reviewerArguments,
  reviewOutputSchema,
  runHeadlessReviewerWithProvenance,
} from '../../src/review/runtime.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

afterEach(() => {
  vi.unstubAllEnvs();
  cleanupTrustedReviewerDirectories();
});

describe('request-bound reviewer output contracts', () => {
  it('requires the current dispatch ID without changing the reusable contract', () => {
    const dispatchId = '6bab86a8-0d1b-4ac4-b654-f0eb6ff43bad';
    const reusable = reviewOutputSchema('plan-execution');
    const bound = JSON.parse(reviewOutputSchema('plan-execution', undefined, dispatchId));

    expect(bound.properties.dispatch_id).toEqual({ type: 'string', enum: [dispatchId] });
    expect(reviewOutputSchema('plan-execution')).toBe(reusable);
    expect(JSON.parse(reusable).properties.dispatch_id).toEqual({ type: 'string' });
    expect(
      JSON.parse(reviewOutputSchema('plan-execution', undefined, 'next-dispatch')).properties
        .dispatch_id,
    ).toEqual({ type: 'string', enum: ['next-dispatch'] });
  });

  it('hands Claude the request-bound schema alongside the planning contract', () => {
    const arguments_ = reviewerArguments(
      'claude',
      undefined,
      undefined,
      {},
      {
        kind: 'plan-execution',
        dispatch_id: 'current-dispatch',
      },
    );
    const schemaArgument = arguments_[arguments_.indexOf('--json-schema') + 1];
    if (schemaArgument === undefined) throw new Error('Claude output schema was not supplied');
    const schema = JSON.parse(schemaArgument);

    expect(schema.properties.dispatch_id).toEqual({
      type: 'string',
      enum: ['current-dispatch'],
    });
    expect(schema.required).toContain('execution_plan_record');
  });

  it('hands the Codex app-server the current dispatch constraint', async () => {
    const bin = createTrustedReviewerDirectory('safeword-bound-schema-');
    const captured = nodePath.join(bin, 'turn-schema.json');
    const output = {
      schema_version: 1,
      evidence_records: { schema_version: 1, records: [] },
      dispatch_id: 'current-dispatch',
      reviewer_agent: 'codex',
      verdict: 'approve',
      summary: 'Reviewed.',
      findings: [],
    };
    writeFileSync(
      nodePath.join(bin, 'codex'),
      String.raw`#!${process.execPath}
import { writeFileSync } from 'node:fs';
if (process.argv.includes('--version')) { console.log('codex 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) {
  console.log(process.argv.includes('app-server') ? '--stdio --config' : ${JSON.stringify(REVIEWER_CAPABILITIES.codex)});
  process.exit(0);
}
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf('\n')) !== -1) {
    const message = JSON.parse(buffer.slice(0, index));
    buffer = buffer.slice(index + 1);
    if (message.id === 1) console.log(JSON.stringify({ id: 1, result: {} }));
    if (message.id === 2) console.log(JSON.stringify({ id: 2, result: {
      thread: { id: 'thread-1' }, model: message.params.model, modelProvider: 'openai',
    } }));
    if (message.id === 3) {
      writeFileSync(${JSON.stringify(captured)}, JSON.stringify(message.params.outputSchema));
      console.log(JSON.stringify({ id: 3, result: { turn: { id: 'turn-1' } } }));
      console.log(JSON.stringify({ method: 'turn/completed', params: {
        threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed', items: [
          { type: 'agentMessage', phase: 'final_answer', text: JSON.stringify(${JSON.stringify(output)}) },
        ] },
      } }));
    }
  }
});
`,
      { mode: 0o755 },
    );
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PATH', bin);

    await runHeadlessReviewerWithProvenance(
      'codex',
      {
        schema_version: 1,
        dispatch_id: 'current-dispatch',
        kind: 'scenario-gate',
        logical_files: [],
      },
      process.cwd(),
      process.cwd(),
      { model: 'gpt-6-astra' },
    );

    expect(JSON.parse(readFileSync(captured, 'utf8')).properties.dispatch_id).toEqual({
      type: 'string',
      enum: ['current-dispatch'],
    });
  });
});
