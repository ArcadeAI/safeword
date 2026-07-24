/**
 * Relative recall FLOOR (ticket 21RAT9, /figure-it-out 2026-07-22).
 *
 * The floor rejects a candidate only when it misses a seed the BASELINE prompt
 * reliably catches — the "protected set". A miss of an UNPROTECTED seed (a
 * stubborn defect the scoring model never catches on any prompt, e.g.
 * determinism-order on a non-Fable model) does NOT reject the candidate:
 *
 *  - an absolute 100%-recall floor over such a seed is unsatisfiable — no
 *    candidate ever passes (the re-measure proved held-out recall never hits
 *    100%, capped by the always-missed determinism-order seed); and
 *  - excluding the defect TYPE would hide a real, fixable weakness. Mutation
 *    testing keeps *stubborn* mutants (killable-but-hard) in the score; only
 *    *equivalent* (unkillable) ones leave the denominator. determinism-order is
 *    stubborn (Fable kills it), so it stays MEASURED.
 *
 * Recall is therefore still measured over ALL seeds (evaluator.aggregate is
 * unchanged — the weakness stays visible); only the reject GATE is relative.
 * This is the safe-policy-improvement pattern: no-regression vs a baseline, with
 * a noise margin so a run-to-run borderline seed doesn't flip protection.
 */

import type { FixtureScore } from './evaluator';
import { defectFamily, DEFAULT_SEVERITY, type DefectType, type ExpectedDefect } from './types';

/**
 * A seed's protection key: scenario (or `*` for fixture-scope) + defect FAMILY.
 * Family (not exact subtype) mirrors the recall metric's family-matching. Caveat:
 * protecting a caught subtype protects the whole family on that scenario — safe
 * only while no scenario seeds two subtypes of one family (asserted in
 * tests/protected-manifest.test.ts). If one ever did, a miss of a
 * systematically-missed sibling (e.g. determinism-order) would breach on the
 * family key, re-introducing the unsatisfiable floor this module exists to kill.
 */
export function seedKey(e: { scenarioId?: string; defectType: DefectType }): string {
  return `${e.scenarioId ?? '*'}::${defectFamily(e.defectType)}`;
}

/** fixture name → the seed keys the baseline reliably catches. */
export type ProtectedSet = Map<string, Set<string>>;

/**
 * The floor-breaching misses: MUST-FIX seeds the candidate missed AND the
 * baseline protects. The floor guards must-fix only — should-strengthen lenses
 * fire on any non-exhaustive spec, so they are measured, never gated (matching
 * the evaluator + validate-skill docs). A `null` protectedSet (no manifest) →
 * strict: every must-fix miss counts. An unknown fixture (absent from the
 * manifest) is also strict — over-guard rather than under-guard.
 */
export function protectedMisses(
  s: FixtureScore,
  protectedSet: ProtectedSet | null,
): ExpectedDefect[] {
  const mustFix = s.falseNegatives.filter(e => DEFAULT_SEVERITY[e.defectType] === 'must-fix');
  if (protectedSet === null) return mustFix;
  const prot = protectedSet.get(s.name);
  if (prot === undefined) return mustFix;
  return mustFix.filter(e => prot.has(seedKey(e)));
}

/** One baseline run's per-fixture caught seed keys. */
export interface BaselineRunCatches {
  name: string;
  caughtKeys: string[];
}

/**
 * Majority-vote the protected set from k baseline runs. A seed is protected only
 * if caught in at least `threshold` runs (default ⌈2k/3⌉ — a MARGIN above half
 * so a seed straddling the flip point is not protected on noise alone).
 */
/** Per-fixture per-key catch count across runs — shared by the floor builder and
 * the multi-run accept gate so both derive "reliably caught" the same way. */
function tallyCatches(runs: BaselineRunCatches[][]): Map<string, Map<string, number>> {
  const counts = new Map<string, Map<string, number>>();
  for (const run of runs) {
    for (const f of run) {
      const m = counts.get(f.name) ?? new Map<string, number>();
      for (const k of f.caughtKeys) m.set(k, (m.get(k) ?? 0) + 1);
      counts.set(f.name, m);
    }
  }
  return counts;
}

export function computeProtectedSet(
  runs: BaselineRunCatches[][],
  threshold: number = Math.ceil((2 * runs.length) / 3),
): ProtectedSet {
  const out: ProtectedSet = new Map();
  for (const [name, m] of tallyCatches(runs)) {
    const prot = new Set<string>();
    for (const [k, c] of m) if (c >= threshold) prot.add(k);
    out.set(name, prot);
  }
  return out;
}

/** A protected seed the candidate fails to RELIABLY catch across its runs. */
export interface ConsensusBreach {
  fixture: string;
  key: string;
  caughtRuns: number;
  runs: number;
}

/**
 * The MULTI-RUN accept-gate floor check (ticket 21RAT9). A single run is too noisy
 * to gate on: the runner sends no temperature, so default-sampling variance makes
 * even the BASELINE miss a protected seed ~1/3 of runs — a one-run gate therefore
 * spuriously rejects good candidates (measured: the winner breaches a one-run floor
 * 2/3 of runs yet holds it on consensus). Instead, run the candidate `runs` times
 * and require it to catch each protected seed on the SAME ⌈2k/3⌉ supermajority that
 * DEFINED the protected set — symmetric reliability for baseline and candidate. A
 * protected seed caught in fewer than ⌈2*runs/3⌉ runs is a real (consensus) breach.
 *
 * `manifest` is the canonical protected set (baseline-protected.json); `fixtures`
 * restricts the check to one split's fixtures. Per-SEED keys (not a per-fixture
 * count) so a two-seed fixture where each seed misses in a DIFFERENT single run —
 * both still caught ⌈2*runs/3⌉ — correctly does NOT breach.
 */
export function consensusFloorBreaches(
  candidateRuns: BaselineRunCatches[][],
  manifest: ProtectedSet,
  fixtures: string[],
): ConsensusBreach[] {
  const runs = candidateRuns.length;
  const threshold = Math.ceil((2 * runs) / 3);
  const counts = tallyCatches(candidateRuns);
  const breaches: ConsensusBreach[] = [];
  for (const name of fixtures) {
    const protectedKeys = manifest.get(name) ?? new Set<string>();
    const caughtCounts = counts.get(name) ?? new Map<string, number>();
    for (const k of protectedKeys) {
      const caughtRuns = caughtCounts.get(k) ?? 0;
      if (caughtRuns < threshold) breaches.push({ fixture: name, key: k, caughtRuns, runs });
    }
  }
  return breaches;
}

interface ProtectedManifest {
  protected: Record<string, string[]>;
}

/** Load a protected-set manifest via an injected reader, or null when absent (→ strict floor). */
export function loadProtectedSet(readFile: () => string | null): ProtectedSet | null {
  const raw = readFile();
  if (raw === null) return null;
  const parsed = JSON.parse(raw) as ProtectedManifest;
  return new Map(Object.entries(parsed.protected).map(([name, keys]) => [name, new Set(keys)]));
}

/** Serialize a protected set to the manifest shape (sorted for stable diffs). */
export function serializeProtectedSet(p: ProtectedSet): ProtectedManifest {
  const out: Record<string, string[]> = {};
  for (const [name, keys] of [...p].sort((a, b) => a[0].localeCompare(b[0]))) {
    out[name] = [...keys].sort();
  }
  return { protected: out };
}
