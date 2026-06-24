/**
 * EVALUATOR seam — the metric.
 *
 * Pure, deterministic set-matching. Because every defect is seeded by us, the
 * ground truth is known exactly, so scoring needs NO LLM judge — this sidesteps
 * the judge-reliability problems (verbosity bias, lenient scoring, missed
 * regressions) that plague fuzzy-ground-truth evals.
 *
 * Two scores, deliberately DECOUPLED (the Phase 3b baseline proved why):
 *
 *  - **Recall** over seeded defects is the trustworthy primary. Every seeded
 *    defect is a known defect, so a miss is unambiguous.
 *  - **False alarms** are counted ONLY on `certifiedClean` fixtures, and ONLY
 *    for must-fix severity. On an ordinary positive fixture the corpus can't be
 *    assumed exhaustive, so an unmatched finding is `unlabeled`, never a false
 *    positive — the IR "unjudged ≠ wrong" rule (bpref). Precision over an
 *    under-labeled positive corpus is formally unidentifiable (PU learning);
 *    the only sound false-alarm signal comes from bases certified clean.
 *
 * There is intentionally NO single F1 headline: collapsing recall and precision
 * into one scalar is exactly what would let a reflective optimizer (GEPA) buy a
 * better number by suppressing real findings. Recall and false-alarm rate are
 * reported and optimized separately.
 *
 * The per-defect breakdown is also the Actionable Side Information (ASI) a
 * reflective optimizer reads to diagnose *where* a candidate fails.
 */

import type { Detection, DefectType, ExpectedDefect, Severity } from './types';
import { DEFECT_TYPES, DEFAULT_SEVERITY, defectFamily } from './types';

export interface FixtureScore {
  name: string;
  certifiedClean: boolean;
  /** The detections that matched a seed (family-level) — what the skill said. */
  truePositives: Detection[];
  /** The seeds that were caught — drives recall + per-type ASI (seed types). */
  caughtSeeds: ExpectedDefect[];
  /** Seeded defects the candidate missed. */
  falseNegatives: ExpectedDefect[];
  /**
   * Must-fix detections on a certifiedClean base that match no seeded defect —
   * the only true false positives. Always empty on a non-certified fixture.
   */
  falseAlarms: Detection[];
  /**
   * Unmatched detections that are NOT penalized: every unmatched finding on a
   * non-certified fixture, plus should-strengthen findings on a clean base.
   * Tracked for inspection (and as ASI), never scored against the candidate.
   */
  unlabeled: Detection[];
  recall: number;
}

export interface SeverityTally {
  tp: number;
  fn: number;
  recall: number;
}

export interface DefectBreakdown {
  defectType: DefectType;
  severity: Severity;
  tp: number;
  /** Must-fix false alarms on certifiedClean fixtures (see FixtureScore). */
  falseAlarms: number;
  fn: number;
  recall: number;
}

export interface AggregateScore {
  /** PRIMARY trustworthy scalar an optimizer maximizes: recall over seeded defects. */
  recall: number;
  seededCaught: number;
  seededTotal: number;
  /** Recall split by harness-derived severity. The recall FLOOR guards `mustFix`. */
  mustFix: SeverityTally;
  shouldStrengthen: SeverityTally;
  /** GUARD signal: must-fix false alarms on certifiedClean fixtures only. */
  falseAlarms: number;
  cleanFixtures: number;
  /** falseAlarms / cleanFixtures (per-clean-fixture rate); 0 when no clean fixtures. */
  falseAlarmRate: number;
  /** Unmatched-but-not-penalized detections, for inspection only. */
  unlabeled: number;
  perFixture: FixtureScore[];
  /** ASI: where the candidate succeeds/fails, by defect type. */
  perDefect: DefectBreakdown[];
}

const key = (d: { scenarioId: string; defectType: DefectType }): string =>
  `${d.scenarioId}::${d.defectType}`;

const recallOf = (tp: number, fn: number): number => (tp + fn === 0 ? 1 : tp / (tp + fn));

/** Score one fixture's detections against its seeded defects. */
export function scoreFixture(
  name: string,
  detections: Detection[],
  expected: ExpectedDefect[],
  certifiedClean = false,
): FixtureScore {
  // Dedupe detections by (scenario, defect) — a candidate gets no credit for
  // reporting the same finding twice, nor double-penalty for a repeated alarm.
  const deduped = [...new Map(detections.map(d => [key(d), d])).values()];
  const consumed = new Set<string>();
  const truePositives: Detection[] = [];
  const caughtSeeds: ExpectedDefect[] = [];
  const falseNegatives: ExpectedDefect[] = [];

  for (const e of expected) {
    const scope = e.scope ?? 'scenario';
    const eFamily = defectFamily(e.defectType);
    // Family-level match: any same-family detection on the seed's scenario
    // counts as catching it (see `defectFamily`). Fixture-scoped seeds match
    // anywhere in the file.
    let match: Detection | undefined;
    if (scope === 'fixture') {
      match = deduped.find(d => defectFamily(d.defectType) === eFamily && !consumed.has(key(d)));
    } else {
      match = deduped.find(
        d =>
          d.scenarioId === e.scenarioId &&
          defectFamily(d.defectType) === eFamily &&
          !consumed.has(key(d)),
      );
    }
    if (match) {
      consumed.add(key(match));
      truePositives.push(match);
      caughtSeeds.push(e);
    } else {
      falseNegatives.push(e);
    }
  }

  // Unmatched detections split by the decoupled rule: a must-fix finding on a
  // certified-clean base is a true false alarm; everything else is unlabeled
  // (unjudged ≠ wrong) and never counts against the candidate.
  const falseAlarms: Detection[] = [];
  const unlabeled: Detection[] = [];
  for (const d of deduped) {
    if (consumed.has(key(d))) continue;
    if (certifiedClean && DEFAULT_SEVERITY[d.defectType] === 'must-fix') {
      falseAlarms.push(d);
    } else {
      unlabeled.push(d);
    }
  }

  return {
    name,
    certifiedClean,
    truePositives,
    caughtSeeds,
    falseNegatives,
    falseAlarms,
    unlabeled,
    recall: recallOf(caughtSeeds.length, falseNegatives.length),
  };
}

/** Micro-average across fixtures and compute the per-defect breakdown (ASI). */
export function aggregate(perFixture: FixtureScore[]): AggregateScore {
  let seededCaught = 0;
  let seededTotal = 0;
  let falseAlarms = 0;
  let unlabeled = 0;
  let cleanFixtures = 0;
  const sev: Record<Severity, { tp: number; fn: number }> = {
    'must-fix': { tp: 0, fn: 0 },
    'should-strengthen': { tp: 0, fn: 0 },
  };
  const byDefect = new Map<DefectType, { tp: number; falseAlarms: number; fn: number }>();
  for (const t of DEFECT_TYPES) byDefect.set(t, { tp: 0, falseAlarms: 0, fn: 0 });

  for (const f of perFixture) {
    if (f.certifiedClean) cleanFixtures += 1;
    falseAlarms += f.falseAlarms.length;
    unlabeled += f.unlabeled.length;
    seededCaught += f.caughtSeeds.length;
    seededTotal += f.caughtSeeds.length + f.falseNegatives.length;
    // Credit recall + ASI by the SEED's type (not the detection's), so a
    // family-level catch with a different subtype still scores against the
    // type we actually seeded.
    for (const e of f.caughtSeeds) {
      byDefect.get(e.defectType)!.tp += 1;
      sev[DEFAULT_SEVERITY[e.defectType]].tp += 1;
    }
    for (const d of f.falseAlarms) byDefect.get(d.defectType)!.falseAlarms += 1;
    for (const e of f.falseNegatives) {
      byDefect.get(e.defectType)!.fn += 1;
      sev[DEFAULT_SEVERITY[e.defectType]].fn += 1;
    }
  }

  const tally = (s: { tp: number; fn: number }): SeverityTally => ({
    ...s,
    recall: recallOf(s.tp, s.fn),
  });
  const perDefect: DefectBreakdown[] = DEFECT_TYPES.map(defectType => {
    const c = byDefect.get(defectType)!;
    return {
      defectType,
      severity: DEFAULT_SEVERITY[defectType],
      ...c,
      recall: recallOf(c.tp, c.fn),
    };
  }).filter(d => d.tp + d.falseAlarms + d.fn > 0);

  return {
    recall: recallOf(seededCaught, seededTotal - seededCaught),
    seededCaught,
    seededTotal,
    mustFix: tally(sev['must-fix']),
    shouldStrengthen: tally(sev['should-strengthen']),
    falseAlarms,
    cleanFixtures,
    falseAlarmRate: cleanFixtures === 0 ? 0 : falseAlarms / cleanFixtures,
    unlabeled,
    perFixture,
    perDefect,
  };
}
