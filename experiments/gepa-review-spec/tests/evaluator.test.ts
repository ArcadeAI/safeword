import { aggregate, scoreFixture } from '../src/evaluator';
import type { Detection, ExpectedDefect } from '../src/types';

describe('scoreFixture — recall (the trustworthy primary)', () => {
  it('catching the seeded defect scores recall 1', () => {
    const expected: ExpectedDefect[] = [
      { scenarioId: 'S1', defectType: 'non-atomic', severity: 'must-fix' },
    ];
    const detections: Detection[] = [{ scenarioId: 'S1', defectType: 'non-atomic' }];
    const s = scoreFixture('f', detections, expected);
    expect(s.truePositives).toHaveLength(1);
    expect(s.falseNegatives).toHaveLength(0);
    expect(s.recall).toBe(1);
  });

  it('a wrong-scenario detection misses the seed (FN); the stray is unlabeled, not a false alarm', () => {
    const expected: ExpectedDefect[] = [
      { scenarioId: 'S1', defectType: 'non-atomic', severity: 'must-fix' },
    ];
    const detections: Detection[] = [{ scenarioId: 'S2', defectType: 'non-atomic' }];
    const s = scoreFixture('f', detections, expected); // certifiedClean defaults false
    expect(s.falseNegatives).toHaveLength(1);
    expect(s.recall).toBe(0);
    expect(s.falseAlarms).toHaveLength(0); // not a certified base → never a false alarm
    expect(s.unlabeled).toHaveLength(1);
  });

  it('matches a fixture-scoped defect regardless of which scenario it is reported on', () => {
    const expected: ExpectedDefect[] = [
      { scope: 'fixture', defectType: 'missing-negative-case', severity: 'should-strengthen' },
    ];
    const detections: Detection[] = [
      { scenarioId: 'anything', defectType: 'missing-negative-case' },
    ];
    const s = scoreFixture('f', detections, expected);
    expect(s.truePositives).toHaveLength(1);
    expect(s.falseAlarms).toHaveLength(0);
    expect(s.unlabeled).toHaveLength(0);
  });

  it('matches a vacuous seed at the FAMILY level — a different vacuous subtype on the same scenario is caught, not double-penalized', () => {
    // The skill flagged the scenario as vacuous-given-echo; we seeded it as
    // vacuous-trivially-true. Same family, same scenario -> caught (TP), and NOT
    // counted as a false alarm on the certified-clean base.
    const s = scoreFixture(
      'mutant',
      [{ scenarioId: 'S1', defectType: 'vacuous-given-echo' }],
      [{ scenarioId: 'S1', defectType: 'vacuous-trivially-true', severity: 'must-fix' }],
      true,
    );
    expect(s.caughtSeeds).toHaveLength(1);
    expect(s.recall).toBe(1);
    expect(s.falseNegatives).toHaveLength(0);
    expect(s.falseAlarms).toHaveLength(0);
  });

  it('a DIFFERENT-family detection on a seeded scenario does not match — still a miss, and a false alarm on a clean base', () => {
    const s = scoreFixture(
      'mutant',
      [{ scenarioId: 'S1', defectType: 'non-atomic' }],
      [{ scenarioId: 'S1', defectType: 'vacuous-existence-only', severity: 'must-fix' }],
      true,
    );
    expect(s.falseNegatives).toHaveLength(1);
    expect(s.recall).toBe(0);
    expect(s.falseAlarms).toHaveLength(1);
  });

  it('deduplicates repeated detections (no double credit)', () => {
    const expected: ExpectedDefect[] = [
      { scenarioId: 'S1', defectType: 'non-atomic', severity: 'must-fix' },
    ];
    const detections: Detection[] = [
      { scenarioId: 'S1', defectType: 'non-atomic' },
      { scenarioId: 'S1', defectType: 'non-atomic' },
    ];
    const s = scoreFixture('f', detections, expected);
    expect(s.truePositives).toHaveLength(1);
    expect(s.unlabeled).toHaveLength(0);
  });
});

describe('scoreFixture — false alarms (only on a certified-clean base, only must-fix)', () => {
  it('an unmatched must-fix finding on a NON-certified positive is unlabeled, not a false positive', () => {
    // The under-labeling fix: the corpus is not exhaustive, so a real-but-unseeded
    // finding must not be penalized (the IR "unjudged ≠ wrong" rule).
    const s = scoreFixture('f', [{ scenarioId: 'S1', defectType: 'vacuous-given-echo' }], []);
    expect(s.falseAlarms).toHaveLength(0);
    expect(s.unlabeled).toHaveLength(1);
  });

  it('an unmatched must-fix finding on a certified-clean base IS a false alarm', () => {
    const s = scoreFixture('clean', [{ scenarioId: 'S1', defectType: 'non-atomic' }], [], true);
    expect(s.falseAlarms).toHaveLength(1);
    expect(s.unlabeled).toHaveLength(0);
    expect(s.recall).toBe(1); // no seeds to miss
  });

  it('a should-strengthen finding on a certified-clean base is advisory — unlabeled, never a false alarm', () => {
    // boundary / failure / missing-negative-case fire on any non-exhaustive spec
    // by design, so they can't be false alarms even on a clean base.
    const s = scoreFixture(
      'clean',
      [
        { scenarioId: 'S1', defectType: 'boundary' },
        { scenarioId: 'S1', defectType: 'failure' },
      ],
      [],
      true,
    );
    expect(s.falseAlarms).toHaveLength(0);
    expect(s.unlabeled).toHaveLength(2);
  });

  it('a certified-clean base with no detections has zero false alarms and recall 1', () => {
    const s = scoreFixture('clean', [], [], true);
    expect(s.falseAlarms).toHaveLength(0);
    expect(s.unlabeled).toHaveLength(0);
    expect(s.recall).toBe(1);
  });

  it('on a single-mutation clean base, the injected defect is caught and a stray must-fix is a false alarm', () => {
    const s = scoreFixture(
      'mutant',
      [
        { scenarioId: 'S1', defectType: 'determinism-time' }, // the injected defect
        { scenarioId: 'S2', defectType: 'non-observable' }, // a stray must-fix → false alarm
      ],
      [{ scenarioId: 'S1', defectType: 'determinism-time', severity: 'must-fix' }],
      true,
    );
    expect(s.truePositives).toHaveLength(1);
    expect(s.recall).toBe(1);
    expect(s.falseAlarms).toHaveLength(1);
    expect(s.falseAlarms[0]).toMatchObject({ defectType: 'non-observable' });
  });
});

describe('aggregate', () => {
  it('splits recall by harness-derived severity and counts false alarms only on clean fixtures', () => {
    const positive = scoreFixture(
      'pos',
      [{ scenarioId: 'S1', defectType: 'non-atomic' }], // caught the must-fix seed
      [
        { scenarioId: 'S1', defectType: 'non-atomic', severity: 'must-fix' },
        { scope: 'fixture', defectType: 'missing-negative-case', severity: 'should-strengthen' }, // missed
      ],
    );
    const clean = scoreFixture(
      'clean',
      [{ scenarioId: 'X', defectType: 'vacuous-non-claim' }], // a must-fix false alarm
      [],
      true,
    );
    const agg = aggregate([positive, clean]);

    expect(agg.seededCaught).toBe(1);
    expect(agg.seededTotal).toBe(2);
    expect(agg.recall).toBe(0.5);
    expect(agg.mustFix).toMatchObject({ tp: 1, fn: 0, recall: 1 });
    expect(agg.shouldStrengthen).toMatchObject({ tp: 0, fn: 1, recall: 0 });
    expect(agg.falseAlarms).toBe(1);
    expect(agg.cleanFixtures).toBe(1);
    expect(agg.falseAlarmRate).toBe(1);

    const missing = agg.perDefect.find(d => d.defectType === 'missing-negative-case');
    expect(missing).toMatchObject({ severity: 'should-strengthen', tp: 0, fn: 1, recall: 0 });
    const vac = agg.perDefect.find(d => d.defectType === 'vacuous-non-claim');
    expect(vac).toMatchObject({ severity: 'must-fix', falseAlarms: 1 });
  });

  it('falseAlarmRate is 0 when there are no certified-clean fixtures', () => {
    const positive = scoreFixture(
      'pos',
      [],
      [{ scenarioId: 'S1', defectType: 'non-atomic', severity: 'must-fix' }],
    );
    const agg = aggregate([positive]);
    expect(agg.cleanFixtures).toBe(0);
    expect(agg.falseAlarms).toBe(0);
    expect(agg.falseAlarmRate).toBe(0);
    expect(agg.recall).toBe(0);
  });
});
