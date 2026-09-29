import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const workflowPaths = [
  '.github/workflows/safeword-pr-review-publisher.yml',
  '.github/workflows/safeword-pr-review-worker.yml',
];

describe('dogfood PR review runtime pin', () => {
  it('uses the installed Safeword version in every published CLI command', () => {
    const installedVersion = readFileSync(
      nodePath.join(repoRoot, '.safeword/version'),
      'utf8',
    ).trim();
    expect(installedVersion).toMatch(/^\d+\.\d+\.\d+$/u);

    for (const workflowPath of workflowPaths) {
      const workflow = readFileSync(nodePath.join(repoRoot, workflowPath), 'utf8');
      const pins = Array.from(workflow.matchAll(/\bsafeword@([^\s"']+)/gu), match => match[1]);

      expect(pins.length, `${workflowPath} must run a pinned Safeword CLI`).toBeGreaterThan(0);
      expect(pins, `${workflowPath} must match .safeword/version`).toEqual(
        Array.from({ length: pins.length }, () => installedVersion),
      );
    }
  });
});
