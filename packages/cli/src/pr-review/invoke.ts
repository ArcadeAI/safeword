// Building the vendor's input and reading its answer (ticket 36EEMY, slice 3).
//
// The runner supplies CONTEXT and shape; the injected prompt supplies judgment.
// Nothing here decides whether a finding is good — that is CWGYH0's to score.

import type { HeadlessJob } from '../../templates/hooks/lib/retro-extract.js';
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

/**
 * The structured answer the runner requires back.
 *
 * WIDE ON PURPOSE. `additionalProperties: false` means codex's constrained
 * decoding rejects anything absent here, so every field the prompt asks the
 * model to produce must appear — otherwise the model cannot emit the shape it
 * was instructed to, however well it followed the instructions.
 *
 * Narrowing this to only what the runner reads was the tempting fix and the
 * wrong one: the extra fields ARE the review's substance (the counter-evidence
 * pass, the confidence cap, the verified fix), and they are what the eval needs
 * to score. `tests/pr-review/output-contract.test.ts` fails if the two drift.
 */
const REVIEW_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: [...VERDICTS] },
    /** One line, actionable without opening the diff. */
    verdict_reason: { type: 'string' },
    /** The model's claim; the runner OVERWRITES it from the actual pairing (R11). */
    cross_model: { type: 'boolean' },
    /** What intent was checked against, and whether it is contract or narrative. */
    intent_source: { type: 'string' },
    /** patch | logic change | new behavior (R19). */
    work_type: { type: 'string' },
    /** push back | ask — the routing decision a posted review ends on (NTB1.R4). */
    decision: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          // Anchoring. Without these a finding cannot become an inline comment.
          path: { type: 'string' },
          line: { type: 'number' },
          // The two layers of the finding: the stake a non-coder reads, and the
          // evidence a coder clicks into.
          consequence: { type: 'string' },
          evidence: { type: 'string' },
          claim: { type: 'string' },
          why_it_matters: { type: 'string' },
          // Which rule produced it, and how hard it pushes.
          dimension: { type: 'string' },
          blocking: { type: 'boolean' },
          confidence: { type: 'string' },
          // The guards the author already had — the counter-evidence pass.
          counter_evidence: { type: 'string' },
          // A patch, present only once the fix gate has RUN it (R13).
          suggestedFix: { type: 'string' },
        },
        required: ['path', 'line', 'consequence'],
      },
    },
  },
  required: ['verdict', 'findings'],
};

/**
 * The review job, in slice 0's real shape.
 *
 * Typed `Review | undefined` because both vendors' parsers return undefined for
 * unusable output, and the Claude runner is fail-open — so "no usable review" is
 * a value the type has to carry rather than an exception.
 */
export type ReviewJob = HeadlessJob<Review | undefined>;

/**
 * The review job: the injected prompt plus the schema the runner can read.
 *
 * `cross_model` is IN the schema so constrained decoding accepts it, but the
 * runner overwrites it from the pairing that actually ran — a model asserting
 * its own independence is the laundering R11 exists to stop. `adversarial` is
 * absent entirely: it is set by the second vendor's outcome, so the first
 * vendor has no business claiming it.
 */
export function createReviewJob(prompt: string): ReviewJob {
  return {
    systemPrompt: prompt,
    schema: REVIEW_OUTPUT_SCHEMA,
    // Already composed by buildReviewInput — no further reduction.
    prepareInput: (raw: string) => raw,
    // Codex gets no tools, so the instructions AND the diff travel inline.
    buildCodexPrompt: (preparedInput: string) =>
      `${prompt}\n\nReturn only JSON matching the provided output schema.\n\n${preparedInput}`,
    // Claude reads from a file, so it gets a pointer rather than the content.
    buildClaudeTaskPrompt: (inputPath: string) =>
      `Read the file ${inputPath} and review the pull request it describes. Output only the review JSON.`,
    // Same parser both ways: the runners strip each vendor's envelope first, so
    // what reaches here is the model's own text in both cases.
    parseCodexOutput: (raw: string) => parseReview(raw),
    parseClaudeResult: (raw: string) => parseReview(raw),
    fallback: undefined,
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
