import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PACKAGED_CAPABILITY_PAIRS,
  PACKAGED_CAPABILITY_REVISION,
  PACKAGED_CAPABILITY_REVISIONS,
  PACKAGED_CAPABILITY_SETTINGS,
  reviewerCapabilityFailure,
} from '../../src/review/capability-catalogue.js';
import {
  buildCapabilityCatalogue,
  capabilityRevision,
  compareSealedCapabilityResults,
  type SealedCapabilityResults,
} from '../../src/review/capability-eval.js';
import {
  REVIEWER_CAPABILITY_MANIFEST,
  REVIEWER_CAPABILITY_PINNED_PAIRS,
  REVIEWER_CAPABILITY_RUBRICS,
} from '../fixtures/reviewer-capability-corpus.js';

function evidencePath(model: string): string {
  return nodePath.join(
    import.meta.dirname,
    '../fixtures/reviewer-capability-evidence',
    `${model}.json`,
  );
}

function evidence(model: string): SealedCapabilityResults {
  return JSON.parse(readFileSync(evidencePath(model), 'utf8')) as SealedCapabilityResults;
}

function optionalEvidence(model: string): SealedCapabilityResults | undefined {
  return existsSync(evidencePath(model)) ? evidence(model) : undefined;
}

describe('packaged reviewer capability evidence', () => {
  it('reports the observed weaker direction through the real catalogue without mocked classification', () => {
    // Frozen negative control, not current admission; fresh pairs are reconstructed below.
    const historical = JSON.parse(
      readFileSync(
        nodePath.join(
          import.meta.dirname,
          '../fixtures/reviewer-capability-evidence/historical-2026-10-20-catalogue.json',
        ),
        'utf8',
      ),
    ) as {
      revision: typeof PACKAGED_CAPABILITY_REVISION;
      pairs: typeof PACKAGED_CAPABILITY_PAIRS;
    };
    const pair = historical.pairs.find(record => record.direction === 'weaker');
    if (pair === undefined) throw new Error('The retained qualification has a weaker direction');
    const author = { provider: pair.author_provider, model: pair.author_model };
    const reviewer = { provider: pair.reviewer_provider, model: pair.reviewer_model };
    expect(
      reviewerCapabilityFailure(
        author,
        reviewer.model,
        reviewer,
        historical.revision,
        historical.pairs,
      ),
    ).toBe('reviewer_capability_weaker');
    expect(
      reviewerCapabilityFailure(
        author,
        `${reviewer.model}-unqualified`,
        reviewer,
        historical.revision,
        historical.pairs,
      ),
    ).toBe('reviewer_capability_unknown');
    const unknown = { ...reviewer, model: `${reviewer.model}-unqualified` };
    expect(
      reviewerCapabilityFailure(
        author,
        unknown.model,
        unknown,
        historical.revision,
        historical.pairs,
      ),
    ).toBe('reviewer_capability_unknown');
  });

  it('reconstructs both directional capability classifications from current sealed results', () => {
    const claude = evidence('claude-opus-5');
    const codex = evidence('gpt-6-astra');
    const revision = capabilityRevision(REVIEWER_CAPABILITY_MANIFEST, REVIEWER_CAPABILITY_RUBRICS);
    expect(PACKAGED_CAPABILITY_REVISION).toEqual(revision);
    expect(PACKAGED_CAPABILITY_SETTINGS).toEqual(REVIEWER_CAPABILITY_MANIFEST.settings);

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
      expect(
        reviewerCapabilityFailure(
          { provider: author.provider, model: author.model },
          reviewer.model,
          { provider: reviewer.provider, model: reviewer.model },
          revision,
          PACKAGED_CAPABILITY_PAIRS,
        ),
      ).toBe(direction === 'weaker' ? 'reviewer_capability_weaker' : undefined);
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

  it('packages exactly the pinned pairs whose sealed evidence is present', () => {
    const built = buildCapabilityCatalogue(
      REVIEWER_CAPABILITY_MANIFEST,
      REVIEWER_CAPABILITY_RUBRICS,
      REVIEWER_CAPABILITY_PINNED_PAIRS,
      optionalEvidence,
    );
    expect(PACKAGED_CAPABILITY_REVISIONS).toEqual(built.revisions);
    expect(PACKAGED_CAPABILITY_PAIRS).toEqual(built.pairs);
    expect(PACKAGED_CAPABILITY_REVISIONS[0]).toEqual({
      ...PACKAGED_CAPABILITY_REVISION,
      models: ['claude-opus-5', 'gpt-6-astra'],
    });
    for (const pair of built.unqualified) {
      expect(
        reviewerCapabilityFailure(
          { provider: 'anthropic', model: pair.anthropic_model },
          pair.openai_model,
          { provider: 'openai', model: pair.openai_model },
          PACKAGED_CAPABILITY_REVISIONS,
          PACKAGED_CAPABILITY_PAIRS,
        ),
      ).toBe('reviewer_capability_unknown');
    }
  });

  it('never combines models from different pinned pairs', () => {
    const mixed = REVIEWER_CAPABILITY_PINNED_PAIRS.flatMap(author =>
      REVIEWER_CAPABILITY_PINNED_PAIRS.filter(reviewer => reviewer !== author).map(reviewer => ({
        author: author.anthropic_model,
        reviewer: reviewer.openai_model,
      })),
    );
    expect(mixed.length).toBeGreaterThan(0);
    for (const { author, reviewer } of mixed) {
      expect(
        reviewerCapabilityFailure(
          { provider: 'anthropic', model: author },
          reviewer,
          { provider: 'openai', model: reviewer },
          PACKAGED_CAPABILITY_REVISIONS,
          PACKAGED_CAPABILITY_PAIRS,
        ),
      ).toBe('reviewer_capability_unknown');
    }
  });
});
