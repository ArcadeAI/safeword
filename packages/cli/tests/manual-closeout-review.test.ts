import { spawnSync } from 'node:child_process';
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

function git(arguments_: string[]): { status: number; stdout: Buffer; stderr: Buffer } {
  const result = spawnSync('git', arguments_, { cwd: repoRoot });
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function sealedCommit(manifest: Manifest): string | undefined {
  const relativeManifest = nodePath.relative(repoRoot, manifestPath);
  const result = git(['log', '--format=%H', '--', relativeManifest]);
  if (result.status !== 0) return undefined;
  const candidates = result.stdout.toString('utf8').trim().split('\n').filter(Boolean);
  return candidates.find(commit =>
    manifest.inputs.every(input => {
      const reviewed = git(['show', `${commit}:${input.path}`]);
      return reviewed.status === 0 && input.sha256 === sha256(reviewed.stdout);
    }),
  );
}

function reviewedInput(path: string, commit: string | undefined): Buffer {
  if (!commit) return readFileSync(nodePath.join(repoRoot, path));
  const result = git(['show', `${commit}:${path}`]);
  return result.status === 0 ? result.stdout : readFileSync(nodePath.join(repoRoot, path));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReviewer(value: unknown): value is Review['reviewer'] {
  return isRecord(value) && typeof value.identity === 'string' && typeof value.model === 'string';
}

function isVerdict(value: unknown): value is Review['verdicts'][number] {
  return isRecord(value) && typeof value.id === 'string' && typeof value.verdict === 'string';
}

function isReview(value: unknown): value is Review {
  return (
    isRecord(value) &&
    isReviewer(value.reviewer) &&
    typeof value.manifest_sha256 === 'string' &&
    Array.isArray(value.verdicts) &&
    value.verdicts.every(isVerdict)
  );
}

function reviewJson(markdown: string): Review {
  const matches = markdown.matchAll(/```json\n([\s\S]*?)\n```/gu).toArray();
  if (matches.length !== 1 || !matches[0]?.[1]) {
    throw new Error('manual-review.md must contain exactly one JSON result block');
  }
  const review: unknown = JSON.parse(matches[0][1]);
  if (!isReview(review)) {
    throw new Error('manual-review.md JSON result has an invalid review shape');
  }
  return review;
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
  it('rejects multiple conflicting review result blocks', () => {
    const result = JSON.stringify({
      reviewer: { identity: 'reviewer-1', model: 'gpt-5' },
      manifest_sha256: '0'.repeat(64),
      verdicts: [],
    });

    expect(() =>
      reviewJson(`\`\`\`json\n${result}\n\`\`\`\n\n\`\`\`json\n${result}\n\`\`\``),
    ).toThrow('manual-review.md must contain exactly one JSON result block');
  });

  it('rejects a malformed review result with a descriptive error', () => {
    expect(() => reviewJson('```json\n{"reviewer":null}\n```')).toThrow(
      'manual-review.md JSON result has an invalid review shape',
    );
  });

  it('binds every sealed artifact and expanded feature example to a passing fresh review', () => {
    const manifestBytes = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestBytes) as Manifest;
    const review = reviewJson(readFileSync(reviewPath, 'utf8'));
    const commit = sealedCommit(manifest);
    if (commit) {
      expect(git(['merge-base', '--is-ancestor', commit, 'HEAD']).status).toBe(0);
    }
    const expectedScenarios = parseFeatureScenarios(
      reviewedInput('features/close-completed-sessions-safely.feature', commit).toString('utf8'),
    ).map((scenario, index) => ({ id: String(index + 1).padStart(2, '0'), title: scenario.title }));

    expect(manifest.ticket).toBe('93C14D');
    expect(manifest.expected_scenarios).toEqual(expectedScenarios);
    expect(manifest.inputs.map(input => input.path)).toEqual([
      '.project/tickets/93C14D-close-completed-sessions-safely/impl-plan.md',
      '.project/tickets/93C14D-close-completed-sessions-safely/test-definitions.md',
      'README.md',
      'package.json',
      'bun.lock',
      'packages/website/src/content/docs/reference/hooks-and-skills.mdx',
      'packages/cli/templates/skills/closeout/SKILL.md',
      '.claude/skills/closeout/SKILL.md',
      '.cursor/commands/closeout.md',
      '.safeword/skills/closeout/SKILL.md',
      '.safeword/hooks/lib/closeout-binding.ts',
      '.safeword/hooks/lib/retro-extract.ts',
      '.safeword/scripts/closeout-cleanup.ts',
      'features/close-completed-sessions-safely.feature',
      'packages/cli/codex-plugin/skills/closeout/SKILL.md',
      'plugin/skills/closeout/SKILL.md',
      'packages/cli/scripts/generate-claude-plugin.ts',
      'packages/cli/src/commands/retro.ts',
      'packages/cli/templates/hooks/lib/closeout-binding.ts',
      'packages/cli/templates/hooks/lib/retro-extract.ts',
      'packages/cli/templates/scripts/closeout-cleanup.ts',
      'plugin/resources/scripts/closeout-cleanup.ts',
      'plugin/runtime/cli.js',
      'plugin/runtime/hooks/lib/closeout-binding.ts',
      'plugin/runtime/hooks/lib/retro-extract.ts',
      'plugin/identity.json',
      'plugin/inventory.json',
      'packages/cli/tests/closeout-skill.test.ts',
      'packages/cli/tests/closeout-cleanup.test.ts',
      'packages/cli/tests/commands/retro.test.ts',
      'packages/cli/tests/hooks/closeout-session-binding.test.ts',
      'packages/cli/tests/hooks/retro-extract.test.ts',
      'packages/cli/tests/integration/closeout-host-adapters.test.ts',
      'packages/cli/tests/smoke/closeout-headless.live.test.ts',
      'packages/cli/tests/manual-closeout-review.test.ts',
      'packages/cli/src/parity.ts',
      'packages/cli/src/codex-plugin/catalogue.ts',
      'packages/cli/src/claude-plugin/catalogue.ts',
      '.project/tickets/93C14D-close-completed-sessions-safely/automated-review-results.json',
    ]);
    for (const input of manifest.inputs) {
      expect(input.sha256, input.path).toBe(sha256(reviewedInput(input.path, commit)));
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
