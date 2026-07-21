// Building the vendor's input and reading its answer (ticket 36EEMY, slice 3).
//
// The runner supplies CONTEXT and shape; the injected prompt supplies judgment.
// Nothing here decides whether a finding is good — that is CWGYH0's to score.

import type { Review, ReviewFinding, Verdict } from './verdict.js';

/** Verdicts the runner will accept. Anything else is unusable output. */
const VERDICTS = new Set<string>(['needs-a-human', 'reviewed', 'unreviewable-as-is']);

/**
 * Cap on the tree handed to the vendor.
 *
 * Every model has a context limit, and exceeding it fails the whole review
 * rather than degrading it. Truncating explicitly — and SAYING so in the input —
 * means the model knows its view is partial instead of quietly reasoning about a
 * codebase it cannot see all of.
 */
const INPUT_BUDGET = 400_000;

export interface ReviewInputParts {
  /** The unified diff — what actually changed. */
  diff: string;
  /** Surrounding tree: files the diff may not touch (R17). */
  files: { path: string; contents: string }[];
  /** Declared intent (the linked issue), when the project exposes any (R6). */
  intent?: string;
}

/**
 * Compose the text the vendor reviews.
 *
 * The diff comes first and is labelled, because the model must be able to tell
 * what CHANGED from what merely exists — a finding about untouched code is
 * off-topic (R12) unless the change made it dangerous.
 */
export function buildReviewInput(parts: ReviewInputParts): string {
  const sections: string[] = [];
  if (parts.intent !== undefined && parts.intent.length > 0) {
    sections.push(`## Declared intent\n\n${parts.intent}`);
  }
  sections.push(`## The diff — this is what changed\n\n${parts.diff}`);

  const header = `${sections.join('\n\n')}\n\n## Surrounding code — context, NOT changed by this pull request\n\n`;
  let budget = INPUT_BUDGET - header.length;
  const rendered: string[] = [];
  let omitted = 0;

  for (const file of parts.files) {
    const block = `### ${file.path}\n\n${file.contents}\n`;
    if (block.length > budget) {
      omitted += 1;
      continue;
    }
    rendered.push(block);
    budget -= block.length;
  }

  const note =
    omitted > 0
      ? `\n_${omitted} file(s) truncated from this view to fit the context budget — the tree is larger than what is shown._\n`
      : '';

  return header + rendered.join('\n') + note;
}

/** The structured answer the runner requires back. See impl-plan §D. */
export const REVIEW_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: [...VERDICTS] },
    work_type: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string' },
          line: { type: 'number' },
          consequence: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['path', 'line', 'consequence'],
      },
    },
    decision: { type: 'string' },
  },
  required: ['verdict', 'findings'],
};

/** Minimal shape of the generalized headless job (slice 0). */
export interface ReviewJob {
  systemPrompt: string;
  schema: unknown;
  prepareInput: (raw: string) => string;
  parseOutput: (raw: string) => Review | undefined;
}

/**
 * The review job: the injected prompt plus the schema the runner can read.
 *
 * `cross_model` and `adversarial` are deliberately absent from the schema. Both
 * are runner-owned — a model asserting its own independence is exactly the
 * laundering R11 exists to stop, and the adversarial mark is set by the second
 * vendor's outcome, not claimed by the first.
 */
export function createReviewJob(prompt: string): ReviewJob {
  return {
    systemPrompt: prompt,
    schema: REVIEW_OUTPUT_SCHEMA,
    prepareInput: (raw: string) => raw,
    parseOutput: (raw: string) => parseReview(raw),
  };
}

function parseReview(raw: string): Review | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  const candidate = parsed as { verdict?: unknown; findings?: unknown; decision?: unknown };
  // A verdict outside the closed set is unusable, not "probably fine" — the
  // verdict is what routes human attention, so guessing at it is worse than
  // failing loudly.
  if (typeof candidate.verdict !== 'string' || !VERDICTS.has(candidate.verdict)) return undefined;
  if (!Array.isArray(candidate.findings)) return undefined;

  const findings = candidate.findings.filter(
    (finding): finding is ReviewFinding =>
      typeof (finding as ReviewFinding)?.path === 'string' &&
      typeof (finding as ReviewFinding)?.consequence === 'string',
  );

  return {
    verdict: candidate.verdict as Verdict,
    findings,
    decision:
      candidate.decision === 'push back' || candidate.decision === 'ask'
        ? candidate.decision
        : undefined,
  };
}

/** What the generalized headless runner returns (slice 0's checked variant). */
export interface VendorRunResult {
  ok: boolean;
  output?: Review;
  findings: unknown[];
  failureReason?: string;
  exitCode?: number | null;
}

/**
 * Spawns the headless vendor. Injected at the command boundary so the whole
 * pipeline is exercisable without a live model — and so the vendor stays a
 * swappable input, which is what lets R11 pick the one that did not write the
 * code.
 */
export type VendorRunner = (job: ReviewJob, input: string) => Promise<VendorRunResult>;

export interface VendorReviewDependencies {
  prompt: string;
  input: string;
  run: VendorRunner;
}

/**
 * Wrap the headless runner as the `review()` thunk `runPrReview` expects.
 *
 * THROWS on vendor failure, deliberately. This is the single most dangerous
 * failure mode in the whole design: an errored vendor whose empty result gets
 * posted as `reviewed`, telling a maintainer nothing was found when in truth
 * nothing was looked at. Failing loudly turns that into a red job instead.
 */
export function createVendorReview(dependencies: VendorReviewDependencies): () => Promise<Review> {
  const job = createReviewJob(dependencies.prompt);

  return async (): Promise<Review> => {
    const result = await dependencies.run(job, dependencies.input);
    if (!result.ok || result.output === undefined) {
      throw new Error(
        `pr-review: the vendor did not return a usable review (${result.failureReason ?? 'unknown'})`,
      );
    }
    return result.output;
  };
}
