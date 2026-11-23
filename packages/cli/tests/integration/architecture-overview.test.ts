import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';

const root = nodePath.resolve(import.meta.dirname, '../../../..');

describe('architecture overview budget', () => {
  it.each([
    [32_767, 0, ''],
    [32_768, 0, '::warning::'],
    [65_536, 0, '::warning::'],
    [65_537, 1, '::error file=ARCHITECTURE.md::'],
  ] as const)('reports the CI outcome for %i bytes', (bytes, status, annotation) => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'architecture-budget-'));
    try {
      writeFileSync(nodePath.join(cwd, 'ARCHITECTURE.md'), Buffer.alloc(bytes, 'a'));
      const result = spawnSync('sh', [nodePath.join(root, 'scripts/check-architecture-size.sh')], {
        cwd,
        encoding: 'utf8',
      });
      expect(result.status).toBe(status);
      if (annotation === '') expect(result.stdout + result.stderr).toBe('');
      else expect(result.stdout + result.stderr).toContain(annotation);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('packages the repository overview and explicit approval records for an owned plan', () => {
    const records = [
      '.project/architecture/digest-bound-planning-decisions-in-the-shared-review-ledger.md',
      '.project/architecture/semantically-projected-planning-review-provenance.md',
    ];
    const plan = '.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/impl-plan.md';
    const prepared = prepareReviewPacket(root, 'plan-implementation', [plan], records);
    try {
      expect(prepared.packet.planning_phase).toBe('plan-implementation');
      for (const path of ['ARCHITECTURE.md', ...records]) {
        const file = prepared.packet.context_files?.find(candidate => candidate.path === path);
        expect(file?.content).toBe(readFileSync(nodePath.join(root, path), 'utf8'));
      }
    } finally {
      prepared.cleanup();
    }
  });
});
