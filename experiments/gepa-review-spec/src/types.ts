/**
 * Shared types for the review-spec eval.
 *
 * The eval is deliberately split into three seams — DATASET, TASK, EVALUATOR —
 * because LangSmith and Arize Phoenix both decompose an eval into exactly those
 * three pieces (dataset + target/task + evaluator). Keeping them as separate
 * pure modules means a platform adapter is a thin wrapper, not a rewrite.
 */

/**
 * Defect categories, each mapped to a check in the `review-spec` skill.
 * The order is the enumeration shown to the model in the eval output contract.
 */
export const DEFECT_TYPES = [
  // vacuous-pass test
  'vacuous-existence-only',
  'vacuous-given-echo',
  'vacuous-trivially-true',
  'vacuous-non-claim',
  // AODI
  'non-atomic',
  'non-observable',
  // determinism risks
  'determinism-time',
  'determinism-order',
  'determinism-concurrency',
  // adversarial / negative-case
  'missing-negative-case',
  // cross-cutting lenses
  'conflict',
  'boundary',
  'failure',
  'security',
  'persona',
] as const;

export type DefectType = (typeof DEFECT_TYPES)[number];

export type Severity = 'must-fix' | 'should-strengthen';

/**
 * Default severity for each defect type — derived by the HARNESS, never read
 * from the model's output. This is the anti-gaming pin: a false-alarm signal
 * keyed on a model-reported severity would let an optimizer dodge the signal by
 * downgrading every finding to `should-strengthen`. By fixing severity to the
 * type taxonomy, "report less / report softer" can't buy a better score.
 *
 * - **must-fix** = structural correctness defects in a single scenario (vacuous
 *   assertion, non-atomic/non-observable scenario, a determinism flake, a
 *   self-contradiction). A confident must-fix claim on a *clean* base is a real
 *   false alarm — this is the only class the precision signal counts.
 * - **should-strengthen** = coverage lenses (missing boundary/failure/security/
 *   persona/negative-case). These fire on *any* non-exhaustive spec by design,
 *   so raising one is correct behavior, never a false alarm.
 */
export const DEFAULT_SEVERITY: Record<DefectType, Severity> = {
  'vacuous-existence-only': 'must-fix',
  'vacuous-given-echo': 'must-fix',
  'vacuous-trivially-true': 'must-fix',
  'vacuous-non-claim': 'must-fix',
  'non-atomic': 'must-fix',
  'non-observable': 'must-fix',
  'determinism-time': 'must-fix',
  'determinism-order': 'must-fix',
  'determinism-concurrency': 'must-fix',
  conflict: 'must-fix',
  'missing-negative-case': 'should-strengthen',
  boundary: 'should-strengthen',
  failure: 'should-strengthen',
  security: 'should-strengthen',
  persona: 'should-strengthen',
};

/**
 * Where a defect lives. Most defects are pinned to one scenario
 * (`scenario`). Set-level findings — a missing rejection path, a
 * cross-scenario conflict, an uncovered boundary — are `fixture`-scoped:
 * they count as caught if the skill reports that defect type anywhere in
 * the file, regardless of which scenario it attaches the finding to.
 */
export type DefectScope = 'scenario' | 'fixture';

/** One seeded defect (ground truth). */
export interface ExpectedDefect {
  defectType: DefectType;
  severity: Severity;
  /** Required for `scenario` scope; optional/ignored for `fixture` scope. */
  scenarioId?: string;
  /** Defaults to `scenario`. */
  scope?: DefectScope;
  /** Human note on why this is a defect (documentation only). */
  note?: string;
}

/** A fixture = one `.feature` file (input) + its labeled defects (reference). */
export interface Fixture {
  name: string;
  featureSource: string;
  expected: ExpectedDefect[];
  split: 'train' | 'test';
  /**
   * The base spec was adjudicated to ZERO latent must-fix defects, so its
   * `expected` list is exhaustive for the must-fix class. Only on a certified
   * base does an unmatched must-fix detection count as a false alarm; on an
   * ordinary positive fixture an unmatched finding is `unlabeled`, never a
   * false positive (the corpus can't be assumed exhaustive — bpref's
   * "unjudged ≠ wrong"). Set true for clean negatives and single-mutation
   * fixtures whose clean base was certified.
   */
  certifiedClean: boolean;
}

/** One defect the skill reported. */
export interface Detection {
  scenarioId: string;
  defectType: DefectType;
}

/** Output of running the skill (a candidate prompt) over one feature file. */
export interface RunOutput {
  detections: Detection[];
  /** Raw model text, kept for trace inspection / debugging. */
  raw?: string;
}

/**
 * TASK seam — anything that can run the review-spec skill over a feature file.
 * The Anthropic runner is the default; a fake runner drives the unit tests; a
 * GEPA adapter calls this with each candidate prompt.
 */
export interface SkillRunner {
  /**
   * @param skillPrompt the candidate `review-spec` SKILL.md body under test
   * @param featureSource the `.feature` file being reviewed
   */
  run(skillPrompt: string, featureSource: string): Promise<RunOutput>;
}
