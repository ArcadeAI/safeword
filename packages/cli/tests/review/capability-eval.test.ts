import { describe, expect, it } from 'vitest';

import {
  buildCapabilityCatalogue,
  type CapabilityFixture,
  type CapabilityManifest,
  capabilityManifestForPair,
  capabilityRevision,
  type CapabilityRun,
  collectCapabilityResults,
  compareCapabilityRuns,
  compareSealedCapabilityResults,
  rescoreCapabilityResults,
  scoreCapabilityRun,
  sealCapabilityResults,
} from '../../src/review/capability-eval.js';
import {
  REVIEWER_CAPABILITY_MANIFEST,
  REVIEWER_CAPABILITY_PINNED_PAIRS,
  REVIEWER_CAPABILITY_RUBRICS,
} from '../fixtures/reviewer-capability-corpus.js';

const fixtures: CapabilityFixture[] = [
  { id: 'product-approve', verdict: 'approve', required: [], forbidden: ['invented-scope'] },
  {
    id: 'product-reject',
    verdict: 'request_changes',
    required: ['missing-outcome'],
    forbidden: ['invented-scope'],
  },
  {
    id: 'implementation-approve',
    verdict: 'approve',
    required: [],
    forbidden: ['invented-design'],
  },
  {
    id: 'implementation-reject',
    verdict: 'request_changes',
    required: ['missing-boundary'],
    forbidden: [],
  },
  { id: 'execution-approve', verdict: 'approve', required: [], forbidden: ['invented-proof'] },
  {
    id: 'execution-reject',
    verdict: 'request_changes',
    required: ['missing-slice'],
    forbidden: [],
  },
];

const floor = { runs_per_fixture: 3, minimum_fixture_passes: 2, minimum_total_percent: 90 };

const manifest: CapabilityManifest = {
  schema_version: 1,
  owner: 'Safeword release maintainers',
  floor,
  settings: { tools: 'none', reasoning: 'medium' },
  fixtures: fixtures.map(label => ({
    label,
    packet: {
      schema_version: 1,
      dispatch_id: label.id,
      kind: 'plan-implementation',
      logical_files: [{ path: 'impl-plan.md', content: `Reviewed plan for ${label.id}` }],
    },
  })),
};

const rubrics = {
  product: 'product rubric',
  implementation: 'implementation rubric',
  execution: 'execution rubric',
};

function runs(): CapabilityRun[] {
  return fixtures.flatMap(fixture =>
    [1, 2, 3].map(run => ({
      fixture_id: fixture.id,
      run,
      verdict: fixture.verdict,
      findings: fixture.required.map(message => ({ severity: 'error' as const, message })),
    })),
  );
}

function withVerdict(
  source: readonly CapabilityRun[],
  index: number,
  verdict: CapabilityRun['verdict'],
): CapabilityRun[] {
  const changed = [...source];
  const previous = changed[index];
  if (previous === undefined) throw new Error(`Missing test run ${index}`);
  changed[index] = { ...previous, verdict };
  return changed;
}

describe('reviewer capability evaluation', () => {
  it('rescores only unchanged sealed observations and preserves their original collection date', () => {
    const original = sealCapabilityResults(
      'openai',
      'exact',
      capabilityRevision(manifest, rubrics),
      runs(),
      '2026-09-28',
    );
    const stronger = {
      ...manifest,
      fixtures: manifest.fixtures.map(fixture => ({
        ...fixture,
        label: { ...fixture.label, finding_groups: [['actual defect']] },
      })),
    };
    const rescored = rescoreCapabilityResults(
      manifest,
      stronger,
      rubrics,
      original,
      '2026-10-21T00:00:00Z',
    );
    expect(rescored.runs).toEqual(original.runs);
    expect(rescored.evidence_date).toBe(original.evidence_date);
    expect(rescored.rescored_from).toEqual({
      results_digest: original.results_digest,
      corpus_digest: original.corpus_digest,
      scored_at: '2026-10-21T00:00:00Z',
    });
    expect(rescored.corpus_digest).not.toBe(original.corpus_digest);
    const compatible = {
      ...manifest,
      fixtures: manifest.fixtures.map(fixture => ({
        ...fixture,
        label: {
          ...fixture.label,
          forbidden: [...fixture.label.forbidden, 'new unobserved defect'],
        },
      })),
    };
    const passing = rescoreCapabilityResults(
      manifest,
      compatible,
      rubrics,
      original,
      '2026-10-21T00:00:00Z',
    );
    expect(compareSealedCapabilityResults(compatible, rubrics, passing, passing)).toBe(
      'not_weaker',
    );
    expect(compareSealedCapabilityResults(stronger, rubrics, rescored, rescored)).toBe('unknown');
    expect(() =>
      rescoreCapabilityResults(manifest, stronger, rubrics, { ...original, runs: [] }, 'now'),
    ).toThrow('original sealed observations');
    expect(() =>
      rescoreCapabilityResults(
        manifest,
        stronger,
        { ...rubrics, product: 'changed' },
        original,
        'now',
      ),
    ).toThrow('unchanged packets');
    for (const changed of [
      { ...stronger, settings: { ...stronger.settings, reasoning: 'high' } },
      { ...stronger, floor: { ...floor, minimum_total_percent: 80 } },
      {
        ...stronger,
        fixtures: stronger.fixtures.map(fixture => ({
          ...fixture,
          packet: { ...fixture.packet, dispatch_id: 'changed' },
        })),
      },
    ])
      expect(() => rescoreCapabilityResults(manifest, changed, rubrics, original, 'now')).toThrow(
        'unchanged packets',
      );
    expect(() => rescoreCapabilityResults(stronger, stronger, rubrics, rescored, 'now')).toThrow(
      'original sealed observations',
    );
  });

  it.each(['product-reject', 'execution-reject'])(
    'does not qualify irrelevant keyword-only findings for %s',
    id => {
      const fixture = REVIEWER_CAPABILITY_MANIFEST.fixtures.find(
        candidate => candidate.label.id === id,
      )?.label;
      if (fixture === undefined) throw new Error('Missing defect fixture');
      expect(
        scoreCapabilityRun(fixture, {
          fixture_id: id,
          run: 1,
          verdict: 'request_changes',
          findings: [
            { severity: 'error', message: 'The rejected release is missing the latest tag.' },
          ],
        }),
      ).toBe(false);
    },
  );
  it('requires a finding about the actual approval-authority defect, not an isolated keyword', () => {
    const fixture = REVIEWER_CAPABILITY_MANIFEST.fixtures.find(
      candidate => candidate.label.id === 'implementation-reject',
    )?.label;
    if (fixture === undefined) throw new Error('Missing implementation defect');
    const score = (messages: string[]) =>
      scoreCapabilityRun(fixture, {
        fixture_id: fixture.id,
        run: 1,
        verdict: 'request_changes',
        findings: messages.map(message => ({ severity: 'error' as const, message })),
      });
    expect(score(['The authenticated banana must be purple.'])).toBe(false);
    expect(
      score([
        'An authenticated approval receipt for a stale job may be accepted before retry binding.',
      ]),
    ).toBe(false);
    expect(score(['An authenticated receipt is present.', 'The approval text has a typo.'])).toBe(
      false,
    );
    expect(
      score([
        'The plan allows approval from an unauthenticated reviewer verdict instead of requiring a receipt.',
      ]),
    ).toBe(true);
    expect(
      score(['Raw reviewer output can grant Approved without an authenticated receipt.']),
    ).toBe(true);
  });
  it('records all three attempts per packet and refuses unconfirmed or mismatched models', async () => {
    const attempts: string[] = [];
    const results = await collectCapabilityResults({
      manifest,
      rubrics,
      provider: 'anthropic',
      model: 'claude-opus-5',
      evidenceDate: '2026-09-28',
      review: packet => {
        attempts.push(packet.dispatch_id);
        return Promise.resolve({
          output: {
            schema_version: 1,
            dispatch_id: packet.dispatch_id,
            evidence_records: { schema_version: 1, records: [] },
            reviewer_agent: 'claude',
            verdict: 'approve',
            summary: 'reviewed',
            findings: [],
          },
          ...(attempts.length !== 1 && {
            confirmedModel: { provider: 'anthropic', model: 'claude-opus-5' },
          }),
        });
      },
    });
    expect(attempts).toHaveLength(fixtures.length * 3);
    expect(results.runs[0]).toMatchObject({
      fixture_id: 'product-approve',
      run: 1,
      verdict: 'invalid',
      failure: 'model_unconfirmed',
    });
    expect(results.runs[1]).toMatchObject({ fixture_id: 'product-approve', run: 2 });
    expect(compareSealedCapabilityResults(manifest, rubrics, results, results)).toBe('unknown');
  });

  it('counts process failure, a different exact model, and a wrong dispatch as failed attempts', async () => {
    const oneFixture = { ...manifest, fixtures: manifest.fixtures.slice(0, 1) };
    let attempt = 0;
    const result = await collectCapabilityResults({
      manifest: oneFixture,
      rubrics,
      provider: 'anthropic',
      model: 'claude-opus-5',
      evidenceDate: '2026-09-28',
      review: packet => {
        attempt += 1;
        if (attempt === 1) return Promise.reject(new Error('review failed'));
        return Promise.resolve({
          confirmedModel: {
            provider: 'anthropic',
            model: attempt === 2 ? 'claude-sonnet-5' : 'claude-opus-5',
          },
          output: {
            schema_version: 1,
            dispatch_id: attempt === 3 ? 'different-dispatch' : packet.dispatch_id,
            evidence_records: { schema_version: 1, records: [] },
            reviewer_agent: 'claude',
            verdict: 'approve',
            summary: 'reviewed',
            findings: [],
          },
        });
      },
    });
    expect(result.runs.map(run => run.failure)).toEqual([
      'review_failed',
      'model_unconfirmed',
      'identity_mismatch',
    ]);
    expect(compareSealedCapabilityResults(oneFixture, rubrics, result, result)).toBe('unknown');
  });

  it('requires the verdict and every labelled finding without forbidden findings', () => {
    const fixture = fixtures[1];
    const run = runs()[3];
    if (fixture === undefined || run === undefined) throw new Error('Missing test fixture');
    expect(scoreCapabilityRun(fixture, run)).toBe(true);
    expect(
      scoreCapabilityRun(fixture, {
        ...run,
        findings: [
          { severity: 'error', message: 'The builder plan has a MISSING-OUTCOME for recovery.' },
        ],
      }),
    ).toBe(true);
    expect(
      scoreCapabilityRun(fixture, {
        ...run,
        findings: [{ severity: 'warning', message: 'The builder plan has a missing-outcome.' }],
      }),
    ).toBe(false);
    expect(scoreCapabilityRun(fixture, { ...run, verdict: 'approve' })).toBe(false);
    expect(scoreCapabilityRun(fixture, { ...run, findings: [] })).toBe(false);
    const approvingFixture = fixtures[0];
    if (approvingFixture === undefined) throw new Error('Missing approval fixture');
    expect(
      scoreCapabilityRun(approvingFixture, {
        fixture_id: approvingFixture.id,
        run: 1,
        verdict: 'approve',
        findings: [{ severity: 'error', message: 'A real blocking defect.' }],
      }),
    ).toBe(false);
    expect(
      scoreCapabilityRun(fixture, {
        ...run,
        findings: [
          { severity: 'error', message: 'missing-outcome' },
          { severity: 'warning', message: 'invented-scope' },
        ],
      }),
    ).toBe(false);
  });

  it('qualifies a candidate only when every fixture and the predeclared 90% floor pass', () => {
    const author = withVerdict(runs(), 0, 'request_changes');
    const candidate = withVerdict(runs(), 0, 'request_changes');
    expect(compareCapabilityRuns(fixtures, author, candidate, floor)).toBe('not_weaker');

    expect(
      compareCapabilityRuns(fixtures, author, withVerdict(candidate, 1, 'request_changes'), floor),
    ).toBe('unknown');
  });

  it('calibrates a known weaker candidate against an author-reliable fixture', () => {
    const candidate = withVerdict(runs(), 1, 'request_changes');
    expect(compareCapabilityRuns(fixtures, runs(), candidate, floor)).toBe('weaker');
  });

  it('refuses incomplete or duplicated three-run evidence', () => {
    const candidate = runs();
    expect(compareCapabilityRuns(fixtures, runs(), candidate.slice(1), floor)).toBe('unknown');
    const previous = candidate[1];
    if (previous === undefined) throw new Error('Missing test run');
    candidate[1] = { ...previous, run: 1 };
    expect(compareCapabilityRuns(fixtures, runs(), candidate, floor)).toBe('unknown');
  });

  it('invalidates old results when the floor, packet, rubric, or settings changes', () => {
    const revision = capabilityRevision(manifest, rubrics);
    const author = sealCapabilityResults(
      'anthropic',
      'claude-exact',
      revision,
      runs(),
      '2026-09-28',
    );
    const candidate = sealCapabilityResults(
      'openai',
      'codex-exact',
      revision,
      runs(),
      '2026-09-28',
    );
    expect(compareSealedCapabilityResults(manifest, rubrics, author, candidate)).toBe('not_weaker');

    expect(
      compareSealedCapabilityResults(
        { ...manifest, floor: { ...floor, minimum_total_percent: 95 } },
        rubrics,
        author,
        candidate,
      ),
    ).toBe('unknown');
    const first = manifest.fixtures[0];
    if (first === undefined) throw new Error('Missing test fixture');
    expect(
      compareSealedCapabilityResults(
        {
          ...manifest,
          fixtures: [
            { ...first, packet: { ...first.packet, dispatch_id: 'changed' } },
            ...manifest.fixtures.slice(1),
          ],
        },
        rubrics,
        author,
        candidate,
      ),
    ).toBe('unknown');
    expect(
      compareSealedCapabilityResults(
        manifest,
        { ...rubrics, product: 'changed' },
        author,
        candidate,
      ),
    ).toBe('unknown');
    expect(
      compareSealedCapabilityResults(
        { ...manifest, settings: { ...manifest.settings, reasoning: 'high' } },
        rubrics,
        author,
        candidate,
      ),
    ).toBe('unknown');
  });

  it('rejects altered result evidence even when its verdicts still look qualified', () => {
    const revision = capabilityRevision(manifest, rubrics);
    const author = sealCapabilityResults(
      'anthropic',
      'claude-exact',
      revision,
      runs(),
      '2026-09-28',
    );
    const candidate = sealCapabilityResults(
      'openai',
      'codex-exact',
      revision,
      runs(),
      '2026-09-28',
    );
    const altered = { ...candidate, runs: withVerdict(candidate.runs, 0, 'request_changes') };
    expect(compareSealedCapabilityResults(manifest, rubrics, author, altered)).toBe('unknown');
  });
});

describe('pinned reviewer capability pairs', () => {
  const existing = { anthropic_model: 'claude-old', openai_model: 'gpt-old' };
  const added = { anthropic_model: 'claude-new', openai_model: 'gpt-new' };

  function sealedFor(pair: typeof existing, model: string, provider: 'anthropic' | 'openai') {
    return sealCapabilityResults(
      provider,
      model,
      capabilityRevision(capabilityManifestForPair(manifest, pair), rubrics),
      runs(),
      '2026-10-30',
    );
  }

  function evidenceFrom(...results: ReturnType<typeof sealedFor>[]) {
    return (model: string) => results.find(result => result.model === model);
  }

  it('keeps the shipped pair revision byte-identical when it is pinned in the pair list', () => {
    const [first] = REVIEWER_CAPABILITY_PINNED_PAIRS;
    expect(
      capabilityRevision(
        capabilityManifestForPair(REVIEWER_CAPABILITY_MANIFEST, first),
        REVIEWER_CAPABILITY_RUBRICS,
      ),
    ).toEqual({
      ...capabilityRevision(REVIEWER_CAPABILITY_MANIFEST, REVIEWER_CAPABILITY_RUBRICS),
      settings_digest: 'acd5a69993710ae8483c78771a67a6d61e061707f39f450a24a9a10511f7bf4d',
    });
  });

  it('pins the latest Opus and Sol pair with its own settings revision', () => {
    expect(REVIEWER_CAPABILITY_PINNED_PAIRS).toContainEqual({
      anthropic_model: 'claude-opus-5-5',
      openai_model: 'gpt-6.1-sol',
    });
    const revisions = REVIEWER_CAPABILITY_PINNED_PAIRS.map(pair =>
      capabilityRevision(
        capabilityManifestForPair(REVIEWER_CAPABILITY_MANIFEST, pair),
        REVIEWER_CAPABILITY_RUBRICS,
      ),
    );
    expect(new Set(revisions.map(revision => revision.corpus_digest)).size).toBe(1);
    expect(new Set(revisions.map(revision => revision.rubric_digest)).size).toBe(1);
    expect(new Set(revisions.map(revision => revision.settings_digest)).size).toBe(
      revisions.length,
    );
  });

  it('emits every pair with complete evidence and leaves a pair without evidence unqualified', () => {
    const catalogue = buildCapabilityCatalogue(
      manifest,
      rubrics,
      [existing, added],
      evidenceFrom(
        sealedFor(existing, 'claude-old', 'anthropic'),
        sealedFor(existing, 'gpt-old', 'openai'),
      ),
    );
    expect(catalogue.unqualified).toEqual([added]);
    expect(catalogue.revisions).toEqual([
      {
        ...capabilityRevision(capabilityManifestForPair(manifest, existing), rubrics),
        models: ['claude-old', 'gpt-old'],
      },
    ]);
    expect(catalogue.pairs.map(record => [record.author_model, record.reviewer_model])).toEqual([
      ['claude-old', 'gpt-old'],
      ['gpt-old', 'claude-old'],
    ]);

    const both = buildCapabilityCatalogue(
      manifest,
      rubrics,
      [existing, added],
      evidenceFrom(
        sealedFor(existing, 'claude-old', 'anthropic'),
        sealedFor(existing, 'gpt-old', 'openai'),
        sealedFor(added, 'claude-new', 'anthropic'),
        sealedFor(added, 'gpt-new', 'openai'),
      ),
    );
    expect(both.unqualified).toEqual([]);
    expect(both.pairs).toHaveLength(4);
    expect(both.pairs.slice(0, 2)).toEqual(catalogue.pairs);
  });

  it('refuses partial, cross-pair or shared-model evidence instead of omitting it', () => {
    const old = [
      sealedFor(existing, 'claude-old', 'anthropic'),
      sealedFor(existing, 'gpt-old', 'openai'),
    ];
    expect(() =>
      buildCapabilityCatalogue(
        manifest,
        rubrics,
        [existing, added],
        evidenceFrom(...old, sealedFor(added, 'claude-new', 'anthropic')),
      ),
    ).toThrow(/partial/i);
    expect(() =>
      buildCapabilityCatalogue(
        manifest,
        rubrics,
        [existing, added],
        evidenceFrom(
          ...old,
          sealedFor(existing, 'claude-new', 'anthropic'),
          sealedFor(existing, 'gpt-new', 'openai'),
        ),
      ),
    ).toThrow(/unqualified/i);
    expect(() =>
      buildCapabilityCatalogue(
        manifest,
        rubrics,
        [existing, { ...added, openai_model: 'gpt-old' }],
        evidenceFrom(...old),
      ),
    ).toThrow(/share/i);
  });
});
