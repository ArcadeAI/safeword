/**
 * Readiness evidence freshness.
 *
 * The pr-readiness skill asks the author to record a durable evidence block
 * pinned to a head SHA, and says never to carry it forward once the head
 * changes. That invariant is the one part of the seven gates a machine can
 * check: four of them are self-attested claims, and the other two are already
 * owned by the repository's own checks and by the advisory review receipt.
 *
 * This evaluator reads the block and nothing else. It never interprets the
 * author's prose, so a pull request body — attacker-controlled on
 * `pull_request_target` — can only ever move the verdict between a fixed set
 * of states whose descriptions are constants.
 */

export type ReadinessVerdict = 'blocked' | 'current' | 'draft' | 'missing' | 'stale';

export interface ReadinessEvidenceInput {
  body: string | null | undefined;
  draft: boolean;
  headSha: string;
}

export interface ReadinessEvidenceReport {
  /** Fixed prose, safe to publish into a privileged step. */
  description: string;
  /** The revision the evidence block claims, when it records one. */
  evidenceSha?: string;
  state: 'failure' | 'success';
  verdict: ReadinessVerdict;
}

/** Never interpolates body content — see the split-privilege note above. */
const DESCRIPTIONS: Record<ReadinessVerdict, string> = {
  blocked: 'Readiness evidence records a blocked gate.',
  current: 'Readiness evidence is current for this head.',
  draft: 'Draft — readiness evidence is not required yet.',
  missing: 'No readiness evidence block in the pull request body.',
  stale: 'Readiness evidence is for an earlier revision.',
};

const FAILING: ReadonlySet<ReadinessVerdict> = new Set<ReadinessVerdict>([
  'blocked',
  'missing',
  'stale',
]);

const EVIDENCE_HEAD = /^[ \t]*Head:[ \t]*([0-9a-f]{7,64})[ \t]*$/imu;
// Dash-agnostic: a numbered gate line that says BLOCKED. Missing a real block
// would be a false pass, which is the one direction this must not fail in.
const BLOCKED_GATE = /^[ \t]*\d+\..*\bBLOCKED\b/mu;

function report(verdict: ReadinessVerdict, evidenceSha?: string): ReadinessEvidenceReport {
  return {
    description: DESCRIPTIONS[verdict],
    ...(evidenceSha !== undefined && { evidenceSha }),
    state: FAILING.has(verdict) ? 'failure' : 'success',
    verdict,
  };
}

export function evaluateReadinessEvidence(input: ReadinessEvidenceInput): ReadinessEvidenceReport {
  if (input.draft) return report('draft');

  const body = input.body ?? '';
  const evidenceSha = EVIDENCE_HEAD.exec(body)?.[1]?.toLowerCase();
  if (evidenceSha === undefined) return report('missing');
  // An abbreviated SHA in the body still identifies the head it was written
  // for; requiring the full form would fail authors for a formatting choice.
  if (!input.headSha.toLowerCase().startsWith(evidenceSha)) return report('stale', evidenceSha);
  if (BLOCKED_GATE.test(body)) return report('blocked', evidenceSha);

  return report('current', evidenceSha);
}
