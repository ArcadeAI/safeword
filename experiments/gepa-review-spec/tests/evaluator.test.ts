import { aggregate, scoreFixture } from '../src/evaluator';
import type { Detection, ExpectedDefect } from '../src/types';

describe('scoreFixture', () => {
  it('scores a perfect match as f1 = 1', () => {
    const expected: ExpectedDefect[] = [
      { scenarioId: 'S1', defectType: 'non-atomic', severity: 'must-fix' },
    ];
    const detections: Detection[] = [{ scenarioId: 'S1', defectType: 'non-atomic' }];
    const s = scoreFixture('f', detections, expected);
    expect(s.truePositives).toHaveLength(1);
    expect(s.f1).toBe(1);
  });

  it('counts a wrong-scenario detection as a false positive and a miss as a false negative', () => {
    const expected: ExpectedDefect[] = [
      { scenarioId: 'S1', defectType: 'non-atomic', severity: 'must-fix' },
    ];
    const detections: Detection[] = [{ scenarioId: 'S2', defectType: 'non-atomic' }];
    const s = scoreFixture('f', detections, expected);
    expect(s.falsePositives).toHaveLength(1);
    expect(s.falseNegatives).toHaveLength(1);
    expect(s.f1).toBe(0);
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
    expect(s.falsePositives).toHaveLength(0);
  });

  it('a clean fixture with no detections scores f1 = 1 (no false alarms)', () => {
    const s = scoreFixture('clean', [], []);
    expect(s.f1).toBe(1);
    expect(s.precision).toBe(1);
    expect(s.recall).toBe(1);
  });

  it('flagging a clean fixture is a false positive (recall stays 1, precision drops)', () => {
    const s = scoreFixture('clean', [{ scenarioId: 'S1', defectType: 'boundary' }], []);
    expect(s.falsePositives).toHaveLength(1);
    expect(s.precision).toBe(0);
  });

  it('deduplicates repeated detections', () => {
    const expected: ExpectedDefect[] = [
      { scenarioId: 'S1', defectType: 'non-atomic', severity: 'must-fix' },
    ];
    const detections: Detection[] = [
      { scenarioId: 'S1', defectType: 'non-atomic' },
      { scenarioId: 'S1', defectType: 'non-atomic' },
    ];
    const s = scoreFixture('f', detections, expected);
    expect(s.truePositives).toHaveLength(1);
    expect(s.falsePositives).toHaveLength(0);
  });
});

describe('aggregate', () => {
  it('micro-averages across fixtures and reports per-defect breakdown (ASI)', () => {
    const a = scoreFixture(
      'a',
      [{ scenarioId: 'S1', defectType: 'non-atomic' }],
      [{ scenarioId: 'S1', defectType: 'non-atomic', severity: 'must-fix' }],
    );
    const b = scoreFixture(
      'b',
      [],
      [{ scenarioId: 'S2', defectType: 'determinism-time', severity: 'must-fix' }],
    );
    const agg = aggregate([a, b]);
    expect(agg.tp).toBe(1);
    expect(agg.fn).toBe(1);
    const determinism = agg.perDefect.find(d => d.defectType === 'determinism-time');
    expect(determinism).toMatchObject({ tp: 0, fn: 1, recall: 0 });
  });
});
