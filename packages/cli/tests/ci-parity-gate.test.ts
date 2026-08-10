/**
 * CI wiring guard: dogfood parity must remain an explicit, required PR job.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const workflowPath = nodePath.resolve(import.meta.dirname, '../../../.github/workflows/ci.yml');

describe('CI dogfood parity gate', () => {
  it('runs the all-mode parity check in a standalone job', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(workflow).toMatch(/^ {2}dogfood-parity:\n/m);
    expect(workflow).toContain('name: Dogfood parity');
    expect(workflow).toContain('bun scripts/parity-check.ts --mode=all');
  });

  it('runs one stable unconditional CLI contract context', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    const job = /^ {2}cli-contract:\n(?<body>[\s\S]*?)(?=^ {2}[a-z][a-z-]+:\n)/mu.exec(workflow)
      ?.groups?.body;

    expect(workflow).toMatch(/^ {2}cli-contract:\n/m);
    expect(job).toContain('name: CLI contract');
    expect(job).toContain('timeout-minutes: 5');
    expect(job).toContain('fetch-depth: 0');
    expect(job).toContain('run: bun run check:cli-contract');
    expect(job).not.toContain('\n    if:');
    expect(job).not.toContain('paths:');
    expect(job).not.toContain('retry');

    const invocations = workflow.match(/run: bun run check:cli-contract/gu) ?? [];
    expect(invocations).toHaveLength(1);

    const fullHistoryCheckouts = workflow.match(
      /# The CLI contract verifies historical Claude release fixtures\.\n {10}fetch-depth: 0/gu,
    );
    expect(fullHistoryCheckouts).toHaveLength(1);
  });
});
