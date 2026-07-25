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
});
