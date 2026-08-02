import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseFeatureScenarios } from '../src/utils/gherkin-feature.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const ticketRoot = nodePath.join(
  repoRoot,
  '.project/tickets/93C14D-close-completed-sessions-safely',
);
const manifestPath = nodePath.join(ticketRoot, 'manual-review-request.json');
const reviewPath = nodePath.join(ticketRoot, 'manual-review.md');

interface Manifest {
  ticket: string;
  inputs: { path: string; sha256: string }[];
  expected_scenarios: { id: string; title: string }[];
}

interface Review {
  reviewer: { identity: string; model: string };
  manifest_sha256: string;
  verdicts: { id: string; verdict: string }[];
}

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function reviewJson(markdown: string): Review {
  const match = /```json\n([\s\S]*?)\n```/u.exec(markdown);
  if (!match?.[1]) throw new Error('manual-review.md must contain one JSON result block');
  return JSON.parse(match[1]) as Review;
}

function reviewIssues(manifest: Manifest, manifestBytes: string, review: Review): string[] {
  const issues: string[] = [];
  if (review.manifest_sha256 !== sha256(manifestBytes)) issues.push('manifest digest mismatch');
  if (!review.reviewer.identity || review.reviewer.identity === 'unknown') {
    issues.push('reviewer identity missing');
  }
  if (!review.reviewer.model || review.reviewer.model === 'unknown') {
    issues.push('reviewer model missing');
  }
  const expected = manifest.expected_scenarios.map(scenario => scenario.id);
  const actual = review.verdicts.map(verdict => verdict.id);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) issues.push('scenario rows mismatch');
  if (review.verdicts.some(verdict => !['pass', 'fail'].includes(verdict.verdict))) {
    issues.push('non-binary verdict');
  }
  if (review.verdicts.some(verdict => verdict.verdict !== 'pass')) issues.push('failing verdict');
  return issues;
}

describe('hash-bound independent closeout review (93C14D)', () => {
  it('binds every current artifact and expanded feature example to a passing fresh review', () => {
    const manifestBytes = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestBytes) as Manifest;
    const review = reviewJson(readFileSync(reviewPath, 'utf8'));
    const featurePath = nodePath.join(repoRoot, 'features/close-completed-sessions-safely.feature');
    const expectedScenarios = parseFeatureScenarios(readFileSync(featurePath, 'utf8')).map(
      (scenario, index) => ({ id: String(index + 1).padStart(2, '0'), title: scenario.title }),
    );

    expect(manifest.ticket).toBe('93C14D');
    expect(manifest.expected_scenarios).toEqual(expectedScenarios);
    expect(manifest.inputs.map(input => input.path)).toEqual([
      '.claude/skills/closeout/SKILL.md',
      '.cursor/commands/closeout.md',
      '.safeword/scripts/closeout-cleanup.ts',
      'features/close-completed-sessions-safely.feature',
      'packages/cli/codex-plugin/skills/closeout/SKILL.md',
      '.project/tickets/93C14D-close-completed-sessions-safely/automated-review-results.json',
    ]);
    for (const input of manifest.inputs) {
      const inputPath = nodePath.join(repoRoot, input.path);
      const currentDigest = sha256(readFileSync(inputPath));
      expect(input.sha256, input.path).toBe(currentDigest);
    }
    expect(reviewIssues(manifest, manifestBytes, review)).toEqual([]);
  });

  it.each([
    ['stale digest', { manifest_sha256: '0'.repeat(64) }, 'manifest digest mismatch'],
    [
      'unknown reviewer',
      { reviewer: { identity: 'unknown', model: 'gpt-5' } },
      'reviewer identity missing',
    ],
    ['missing row', { verdicts: [] }, 'scenario rows mismatch'],
    ['non-binary row', { verdicts: [{ id: '01', verdict: 'maybe' }] }, 'non-binary verdict'],
    ['failing row', { verdicts: [{ id: '01', verdict: 'fail' }] }, 'failing verdict'],
  ])('rejects %s', (_name, override, expected) => {
    const manifest: Manifest = {
      ticket: '93C14D',
      inputs: [],
      expected_scenarios: [{ id: '01', title: 'one' }],
    };
    const bytes = JSON.stringify(manifest);
    const review: Review = {
      reviewer: { identity: 'reviewer-1', model: 'gpt-5' },
      manifest_sha256: sha256(bytes),
      verdicts: [{ id: '01', verdict: 'pass' }],
      ...override,
    };
    expect(reviewIssues(manifest, bytes, review)).toContain(expected);
  });
});
