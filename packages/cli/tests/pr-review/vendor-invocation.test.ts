import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildReviewInput,
  createReviewJob,
  createVendorReview,
} from '../../src/pr-review/invoke.js';
import { resolveReviewPrompt } from '../../src/pr-review/prompt.js';

const PROMPT = 'You are a reviewer. Return only the review JSON.';

describe('resolving the review prompt (36EEMY)', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'sw-prompt-'));
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('is absent until the skill ships — the judgment is a separate deliverable', () => {
    // G5337S owns the prompt and is blocked on the eval (CWGYH0). The runner
    // must be complete and simply have nothing to say yet, rather than be
    // half-built around a prompt it invented for itself.
    expect(resolveReviewPrompt(projectDirectory)).toBeUndefined();
  });

  it('reads the installed skill once it exists', () => {
    const skill = nodePath.join(projectDirectory, '.claude', 'skills', 'pr-review');
    mkdirSync(skill, { recursive: true });
    writeFileSync(nodePath.join(skill, 'SKILL.md'), PROMPT);

    expect(resolveReviewPrompt(projectDirectory)).toBe(PROMPT);
  });

  it('honours an explicit override, so the eval can swap the judgment', () => {
    const custom = nodePath.join(projectDirectory, 'my-prompt.md');
    writeFileSync(custom, 'a different judgment');

    expect(resolveReviewPrompt(projectDirectory, custom)).toBe('a different judgment');
  });
});

describe('autonomous-pr-review.TB1.R17 — the vendor sees the tree, not just the diff', () => {
  it('autonomous-pr-review.TB1.R17.a_finding_rests_on_a_file_the_diff_did_not_touch', () => {
    // The runner-ownable half of R17. Whether the MODEL then cites the
    // unchanged file is judgment (CWGYH0's to score); what this proves is that
    // the runner put the file in front of it at all. A diff-only input makes
    // the finding structurally impossible.
    const input = buildReviewInput({
      diff: '--- a/src/caller.ts\n+++ b/src/caller.ts\n+  helper(userInput)',
      files: [
        { path: 'src/caller.ts', contents: 'helper(userInput)' },
        { path: 'src/helper.ts', contents: 'export function helper(x) { eval(x) }' },
      ],
    });

    expect(input).toContain('src/helper.ts');
    expect(input).toContain('eval(x)');
    // ...and the diff is still distinguishable from the surrounding tree, so
    // the model can tell what changed from what merely exists.
    expect(input).toMatch(/diff/i);
  });

  it('bounds the input — a huge tree cannot be sent whole', () => {
    const files = Array.from({ length: 400 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      contents: 'x'.repeat(5000),
    }));

    const input = buildReviewInput({ diff: 'a diff', files });

    // Every model has a context limit; exceeding it fails the whole review
    // rather than degrading it. Truncation must be explicit, not incidental.
    expect(input.length).toBeLessThan(400 * 5000);
    expect(input).toMatch(/truncat/i);
  });
});

describe('the review job and its invocation', () => {
  it('asks for the review schema and carries the injected prompt', () => {
    const job = createReviewJob(PROMPT);

    expect(job.systemPrompt).toBe(PROMPT);
    const schema = job.schema as { properties?: Record<string, unknown> };
    expect(Object.keys(schema.properties ?? {})).toEqual(
      expect.arrayContaining(['verdict', 'findings']),
    );
  });

  it('parses a well-formed review and rejects a malformed one', () => {
    const job = createReviewJob(PROMPT);

    expect(job.parseOutput('{"verdict":"reviewed","findings":[],"decision":null}')).toMatchObject({
      verdict: 'reviewed',
      findings: [],
    });
    // A verdict outside the closed set is unusable, not "probably fine".
    expect(job.parseOutput('{"verdict":"looks-good","findings":[]}')).toBeUndefined();
    expect(job.parseOutput('not json')).toBeUndefined();
  });

  it('turns a vendor failure into a thrown fault, never a clean empty review', async () => {
    // The single most dangerous failure mode: an errored vendor whose empty
    // result is posted as `reviewed`, telling a maintainer nothing was found
    // when in truth nothing was looked at.
    const review = createVendorReview({
      prompt: PROMPT,
      input: 'a diff',
      run: () =>
        Promise.resolve({ ok: false as const, failureReason: 'spawn_nonzero', findings: [] }),
    });

    await expect(review()).rejects.toThrow(/spawn_nonzero/);
  });

  it('returns the parsed review when the vendor succeeds', async () => {
    const review = createVendorReview({
      prompt: PROMPT,
      input: 'a diff',
      run: () =>
        Promise.resolve({
          ok: true as const,
          output: { verdict: 'needs-a-human' as const, findings: [] },
          findings: [],
        }),
    });

    await expect(review()).resolves.toMatchObject({ verdict: 'needs-a-human' });
  });
});
