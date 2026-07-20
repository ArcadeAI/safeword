import { describe, expect, it } from 'vitest';

import type { PrReviewConfig } from '../../src/pr-review/config.js';
import { createReviewPoster, type GitHubCall } from '../../src/pr-review/poster.js';
import { runPrReview } from '../../src/pr-review/run.js';
import type { TriggerContext } from '../../src/pr-review/trigger.js';
import type { Review } from '../../src/pr-review/verdict.js';

const CONTEXT = { owner: 'acme', repo: 'monorepo', pull: 42, headSha: 'deadbeef' };

const ON: PrReviewConfig = {
  enabled: true,
  post: true,
  identityMode: 'shared',
  requiredChecks: [],
};

const READY_AND_GREEN: TriggerContext = {
  isDraft: false,
  ciState: 'green',
  headSha: 'deadbeef',
};

const oneFinding: Review = {
  verdict: 'needs-a-human',
  findings: [{ path: 'src/auth.ts', line: 12, consequence: 'A prefix match authenticates.' }],
};

function harness() {
  const calls: GitHubCall[] = [];
  const order: string[] = [];
  const poster = createReviewPoster((method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body });
    order.push('post');
    return Promise.resolve({});
  }, CONTEXT);
  return { calls, order, poster };
}

describe('runPrReview — composition order (36EEMY slice 3)', () => {
  it('never invokes the vendor when the project has it switched off', async () => {
    const { poster } = harness();
    let invoked = 0;

    const result = await runPrReview({
      config: { ...ON, enabled: false },
      trigger: READY_AND_GREEN,
      poster,
      review: () => {
        invoked += 1;
        return Promise.resolve(oneFinding);
      },
    });

    // A vendor invocation costs real money and real CI minutes, so the cheapest
    // disqualifier has to come first.
    expect(invoked).toBe(0);
    expect(result.ran).toBe(false);
  });

  it('never invokes the vendor when the trigger says not to review', async () => {
    const { poster } = harness();
    let invoked = 0;

    const result = await runPrReview({
      config: ON,
      trigger: { ...READY_AND_GREEN, ciState: 'red' },
      poster,
      review: () => {
        invoked += 1;
        return Promise.resolve(oneFinding);
      },
    });

    expect(invoked).toBe(0);
    expect(result.ran).toBe(false);
    expect(result.reason).toMatch(/red/i);
  });

  it('invokes the vendor and posts when ready and green — the discriminating positive', async () => {
    const { calls, poster } = harness();
    let invoked = 0;

    const result = await runPrReview({
      config: ON,
      trigger: READY_AND_GREEN,
      poster,
      review: () => {
        invoked += 1;
        return Promise.resolve(oneFinding);
      },
    });

    expect(invoked).toBe(1);
    expect(result.ran).toBe(true);
    expect(result.posted).toBe(true);
    expect(calls.filter(c => c.path.endsWith('/comments'))).toHaveLength(1);
  });

  it('runs the adversary BEFORE anything is posted', async () => {
    const { order, poster } = harness();

    await runPrReview({
      config: ON,
      trigger: READY_AND_GREEN,
      poster,
      review: () => Promise.resolve(oneFinding),
      adversary: () => {
        order.push('adversary');
        return Promise.resolve('refuted');
      },
    });

    // A contested mark that lands after the comment is a correction, not a
    // confidence signal — the reader already saw the unqualified version.
    expect(order[0]).toBe('adversary');
    expect(order).toContain('post');
  });

  it('carries the adversary’s mark into the posted comment', async () => {
    const { calls, poster } = harness();

    await runPrReview({
      config: ON,
      trigger: READY_AND_GREEN,
      poster,
      review: () => Promise.resolve(oneFinding),
      adversary: () => Promise.resolve('refuted'),
    });

    const comment = calls.find(c => c.path.endsWith('/comments'));
    expect(JSON.stringify(comment?.body)).toMatch(/contested/i);
  });

  it('skips the adversary entirely when the review found nothing', async () => {
    const { poster } = harness();
    let adversaryCalls = 0;

    const result = await runPrReview({
      config: ON,
      trigger: READY_AND_GREEN,
      poster,
      review: () => Promise.resolve({ verdict: 'reviewed', findings: [] }),
      adversary: () => {
        adversaryCalls += 1;
        return Promise.resolve('affirmed');
      },
    });

    expect(adversaryCalls).toBe(0);
    expect(result.posted).toBe(true);
  });

  it('degrades to silence when no vendor is wired — never a red job', async () => {
    // This is what makes it safe to SHIP the workflow before the vendor slice
    // lands. A customer who reads the docs and sets prReview.enabled gets a
    // green job that explains itself. An earlier version threw here, which
    // would have reddened CI on every ready-and-green pull request.
    const { calls, poster } = harness();

    const result = await runPrReview({ config: ON, trigger: READY_AND_GREEN, poster });

    expect(result.ran).toBe(false);
    expect(result.posted).toBe(false);
    expect(result.reason).toMatch(/no vendor configured/i);
    expect(calls).toHaveLength(0);
  });

  it('propagates a vendor fault instead of swallowing it into a clean review', async () => {
    const { calls, poster } = harness();

    await expect(
      runPrReview({
        config: ON,
        trigger: READY_AND_GREEN,
        poster,
        review: () => Promise.reject(new Error('codex exec exited 1')),
      }),
    ).rejects.toThrow(/codex exec/);

    // Nothing posted: a failed run must never leave a receipt claiming a review
    // that did not happen.
    expect(calls).toHaveLength(0);
  });
});
