import { loadFixtures, testSplit, trainSplit } from '../src/dataset';
import { runEval } from '../src/harness';
import { parseDetections, fakeRunner } from '../src/task';
import type { Detection } from '../src/types';

describe('dataset', () => {
  it('loads the seed corpus with parsed labels, splits, and clean-certification', () => {
    const fixtures = loadFixtures();
    expect(fixtures.length).toBeGreaterThanOrEqual(3);
    expect(trainSplit(fixtures).length).toBeGreaterThan(0);
    expect(testSplit(fixtures).length).toBeGreaterThan(0);

    const refund = fixtures.find(f => f.name === 'payment-refund');
    expect(refund?.expected).toHaveLength(2);
    expect(refund?.certifiedClean).toBe(false); // a positive fixture is not a clean base

    const clean = fixtures.find(f => f.name === 'inventory-sync');
    expect(clean?.expected).toHaveLength(0);
    expect(clean?.certifiedClean).toBe(true); // adjudicated clean → false alarms count here
  });
});

describe('parseDetections', () => {
  it('extracts the JSON block and drops unknown defect types', () => {
    const raw = [
      'Some prose findings...',
      '```json',
      '{ "detections": [',
      '  { "scenarioId": "S1", "defectType": "non-atomic" },',
      '  { "scenarioId": "S1", "defectType": "not-a-real-type" }',
      '] }',
      '```',
    ].join('\n');
    expect(parseDetections(raw)).toEqual([{ scenarioId: 'S1', defectType: 'non-atomic' }]);
  });

  it('returns [] when there is no parseable block', () => {
    expect(parseDetections('no json here')).toEqual([]);
  });
});

describe('runEval', () => {
  it('a perfect skill (returns each fixture’s seeded defects) scores recall 1 with no false alarms', async () => {
    const fixtures = loadFixtures();
    // Build a lookup from feature source -> the detections a perfect skill would emit.
    const perfect = new Map<string, Detection[]>(
      fixtures.map(f => [
        f.featureSource,
        f.expected.map(e => ({ scenarioId: e.scenarioId ?? '*', defectType: e.defectType })),
      ]),
    );
    const runner = fakeRunner((_skill, source) => perfect.get(source) ?? []);
    const score = await runEval('candidate prompt', fixtures, runner);
    expect(score.recall).toBe(1);
    expect(score.seededCaught).toBe(score.seededTotal);
    expect(score.falseAlarms).toBe(0);
  });

  it('a skill that finds nothing has recall 0 on the defective fixtures and raises no false alarms', async () => {
    const fixtures = trainSplit(loadFixtures());
    const runner = fakeRunner(() => []);
    const score = await runEval('candidate prompt', fixtures, runner);
    expect(score.seededCaught).toBe(0);
    expect(score.recall).toBe(0);
    expect(score.falseAlarms).toBe(0);
  });
});
