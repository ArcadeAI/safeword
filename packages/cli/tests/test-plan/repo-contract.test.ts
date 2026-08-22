import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveTestPlan } from '../../src/test-plan/resolve';
import { repoRoot } from '../helpers';

describe('repository test-plan contract', () => {
  it('does not exclude the entire Python experiment tree from MyPy', () => {
    const plan = resolveTestPlan(repoRoot, {
      kind: 'typecheck',
      isToolAvailable: () => true,
    });
    const config = readFileSync(nodePath.join(repoRoot, 'mypy.ini'), 'utf8');

    expect(plan.some(entry => entry.language === 'python' && entry.command === 'mypy .')).toBe(
      true,
    );
    expect(config).not.toContain('exclude = ^experiments/\n');
  });
});
