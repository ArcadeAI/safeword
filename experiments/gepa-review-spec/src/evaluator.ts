/**
 * EVALUATOR seam — the metric.
 *
 * Pure, deterministic set-matching. Because every defect is seeded by us, the
 * ground truth is known exactly, so scoring needs NO LLM judge — this sidesteps
 * the judge-reliability problems (verbosity bias, lenient scoring, missed
 * regressions) that plague fuzzy-ground-truth evals.
 *
 * The per-defect breakdown is also the Actionable Side Information (ASI) a
 * reflective optimizer like GEPA reads to diagnose *where* a candidate fails.
 */

import type { Detection, DefectType, ExpectedDefect } from './types';
import { DEFECT_TYPES } from './types';

export interface FixtureScore {
  name: string;
  truePositives: Detection[];
  falsePositives: Detection[];
  falseNegatives: ExpectedDefect[];
  precision: number;
  recall: number;
  f1: number;
}

export interface DefectBreakdown {
  defectType: DefectType;
  tp: number;
  fp: number;
  fn: number;
  recall: number;
}

export interface AggregateScore {
  /** Primary scalar an optimizer maximizes: micro-averaged F1 across fixtures. */
  f1: number;
  precision: number;
  recall: number;
  tp: number;
  fp: number;
  fn: number;
  perFixture: FixtureScore[];
  /** ASI: where the candidate succeeds/fails, by defect type. */
  perDefect: DefectBreakdown[];
}

const key = (d: { scenarioId: string; defectType: DefectType }): string =>
  `${d.scenarioId}::${d.defectType}`;

function prf(
  tp: number,
  fp: number,
  fn: number,
): { precision: number; recall: number; f1: number } {
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

/** Score one fixture's detections against its seeded defects. */
export function scoreFixture(
  name: string,
  detections: Detection[],
  expected: ExpectedDefect[],
): FixtureScore {
  // Dedupe detections by (scenario, defect) — a candidate gets no credit for
  // reporting the same finding twice.
  const deduped = [...new Map(detections.map(d => [key(d), d])).values()];
  const consumed = new Set<string>();
  const truePositives: Detection[] = [];
  const falseNegatives: ExpectedDefect[] = [];

  for (const e of expected) {
    const scope = e.scope ?? 'scenario';
    let match: Detection | undefined;
    if (scope === 'fixture') {
      // Set-level: any detection of this defect type counts.
      match = deduped.find(d => d.defectType === e.defectType && !consumed.has(key(d)));
    } else {
      match = deduped.find(
        d =>
          d.scenarioId === e.scenarioId && d.defectType === e.defectType && !consumed.has(key(d)),
      );
    }
    if (match) {
      consumed.add(key(match));
      truePositives.push(match);
    } else {
      falseNegatives.push(e);
    }
  }

  const falsePositives = deduped.filter(d => !consumed.has(key(d)));
  const { precision, recall, f1 } = prf(
    truePositives.length,
    falsePositives.length,
    falseNegatives.length,
  );

  return { name, truePositives, falsePositives, falseNegatives, precision, recall, f1 };
}

/** Micro-average across fixtures and compute the per-defect breakdown (ASI). */
export function aggregate(perFixture: FixtureScore[]): AggregateScore {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  const byDefect = new Map<DefectType, { tp: number; fp: number; fn: number }>();
  for (const t of DEFECT_TYPES) byDefect.set(t, { tp: 0, fp: 0, fn: 0 });

  for (const f of perFixture) {
    tp += f.truePositives.length;
    fp += f.falsePositives.length;
    fn += f.falseNegatives.length;
    for (const d of f.truePositives) byDefect.get(d.defectType)!.tp += 1;
    for (const d of f.falsePositives) byDefect.get(d.defectType)!.fp += 1;
    for (const e of f.falseNegatives) byDefect.get(e.defectType)!.fn += 1;
  }

  const { precision, recall, f1 } = prf(tp, fp, fn);
  const perDefect: DefectBreakdown[] = DEFECT_TYPES.map(defectType => {
    const c = byDefect.get(defectType)!;
    return { defectType, ...c, recall: prf(c.tp, 0, c.fn).recall };
  }).filter(d => d.tp + d.fp + d.fn > 0);

  return { f1, precision, recall, tp, fp, fn, perFixture, perDefect };
}
