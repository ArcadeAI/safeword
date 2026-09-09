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

/** The closed set a published status description may come from. */
export const READINESS_DESCRIPTIONS: readonly string[] = Object.values(DESCRIPTIONS);

const FAILING: ReadonlySet<ReadinessVerdict> = new Set<ReadinessVerdict>([
  'blocked',
  'missing',
  'stale',
]);

const HEAD_LINE = /^[ \t]*Head:[ \t]*([0-9a-f]{7,64})[ \t]*$/iu;
const GATE_LINE = /^[ \t]*(\d+)\.[ \t]*\S/u;
// Dash-agnostic: a numbered gate line that says BLOCKED. Missing a real block
// would be a false pass, which is the one direction this must not fail in.
const BLOCKED_GATE_LINE = /^[ \t]*\d+\..*\bBLOCKED\b/iu;

interface EvidenceBlock {
  blocked: boolean;
  sha: string;
}

/** Reads the gate lines belonging to one block, stopping at the next block. */
function scanGates(rest: readonly string[]): { blocked: boolean; gates: number } {
  let blocked = false;
  let gates = 0;

  for (const line of rest) {
    if (HEAD_LINE.test(line)) break;
    const gate = GATE_LINE.exec(line);
    if (gate === null || Number(gate[1]) !== gates + 1) break;
    gates += 1;
    if (BLOCKED_GATE_LINE.test(line)) blocked = true;
    if (gates === 7) break;
  }

  return { blocked, gates };
}

/**
 * A `Head:` line alone is not evidence — the numbered gates after it are what
 * make it a block. Anchoring on the block keeps an unrelated `Head:` line
 * elsewhere in the body from standing in for evidence that is actually stale.
 */
function evidenceBlocks(body: string): EvidenceBlock[] {
  // GitHub's web editor submits CRLF, and a trailing \r would keep HEAD_LINE
  // from matching an otherwise valid block.
  const lines = body.split(/\r?\n/u);
  const blocks: EvidenceBlock[] = [];

  for (const [index, line] of lines.entries()) {
    const sha = HEAD_LINE.exec(line)?.[1];
    if (sha === undefined) continue;
    const { blocked, gates } = scanGates(lines.slice(index + 1));
    if (gates === 7) blocks.push({ blocked, sha: sha.toLowerCase() });
  }

  return blocks;
}

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

  const blocks = evidenceBlocks(input.body ?? '');
  if (blocks.length === 0) return report('missing');

  // Fail safe when a body carries more than one block: any stale or blocked one
  // decides the verdict, so a fresher block cannot mask an older one.
  const head = input.headSha.toLowerCase();
  // An abbreviated SHA in the body still identifies the head it was written
  // for; requiring the full form would fail authors for a formatting choice.
  const stale = blocks.find(block => !head.startsWith(block.sha));
  if (stale !== undefined) return report('stale', stale.sha);

  const blocked = blocks.find(block => block.blocked);
  if (blocked !== undefined) return report('blocked', blocked.sha);

  return report('current', blocks[0]?.sha);
}
