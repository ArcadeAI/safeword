import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PACKAGED_CAPABILITY_PAIRS,
  PACKAGED_CAPABILITY_REVISION,
} from '../../src/review/capability-catalogue.js';
import {
  capabilityRevision,
  compareSealedCapabilityResults,
  type SealedCapabilityResults,
} from '../../src/review/capability-eval.js';
import {
  REVIEWER_CAPABILITY_MANIFEST,
  REVIEWER_CAPABILITY_RUBRICS,
} from '../fixtures/reviewer-capability-corpus.js';

function evidence(model: string): SealedCapabilityResults {
  const path = nodePath.join(
    import.meta.dirname,
    '../fixtures/reviewer-capability-evidence',
    `${model}.json`,
  );
  return JSON.parse(readFileSync(path, 'utf8')) as SealedCapabilityResults;
}

describe('packaged reviewer capability evidence', () => {
  it('qualifies both shipped default cross-provider orderings from current sealed results', () => {
    const claude = evidence('claude-opus-5');
    const codex = evidence('gpt-6-astra');
    const revision = capabilityRevision(REVIEWER_CAPABILITY_MANIFEST, REVIEWER_CAPABILITY_RUBRICS);
    expect(PACKAGED_CAPABILITY_REVISION).toEqual(revision);
    expect(PACKAGED_CAPABILITY_PAIRS).toHaveLength(2);

    for (const [author, reviewer] of [
      [claude, codex],
      [codex, claude],
    ] as const) {
      const direction = compareSealedCapabilityResults(
        REVIEWER_CAPABILITY_MANIFEST,
        REVIEWER_CAPABILITY_RUBRICS,
        author,
        reviewer,
      );
      expect(direction).not.toBe('unknown');
      const resultsDigest = createHash('sha256')
        .update(`${author.results_digest}\0${reviewer.results_digest}`)
        .digest('hex');
      expect(PACKAGED_CAPABILITY_PAIRS).toContainEqual({
        ...revision,
        author_provider: author.provider,
        author_model: author.model,
        reviewer_provider: reviewer.provider,
        reviewer_model: reviewer.model,
        direction,
        qualification: 'pinned-corpus',
        evidence_date:
          author.evidence_date.localeCompare(reviewer.evidence_date) > 0
            ? author.evidence_date
            : reviewer.evidence_date,
        results_digest: resultsDigest,
      });
    }
  });
});
