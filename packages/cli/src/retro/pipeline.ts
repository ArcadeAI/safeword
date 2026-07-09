// The friction → safe-encounter pipeline. This is where every egress wall is
// composed, in order, before anything can be filed:
//   1. normalizeFinding  — schema wall (drop off-schema fields / bad shape)
//   2. resolveSurface    — fail closed if the surface isn't a real safeword path
//   3. sanitizeText      — deny-by-default scrub of every free-text field
//   4. buildDraft        — code-assembled body from the sanitized fields only
// The result is an Encounter ready for triage. Reusable across retro's
// front-ends (transcript miner now; a future `safeword report` later).

import { buildDraft } from './draft.js';
import { resolveSurface, sanitizeTextDeep } from './egress.js';
import { type Finding, normalizeFinding } from './finding.js';
import { shortHash } from './hash.js';
import type { Encounter } from './triage.js';

// Hard ceiling on raw findings processed in one run. Each finding costs four
// async secretlint passes, and `--auto-extract` feeds in model output whose
// length we don't control — a runaway/adversarial `claude -p` array must not
// fire thousands of secretlint calls inside the synchronous Stop hook. A real
// session yields a handful; this is generous headroom for recurrences (triage
// caps issue *creation* at 5, but recurrence bumps are unbounded) while keeping
// the cost ceiling explicit. Excess is dropped (anti-abuse bound, not lossy on
// legitimate input).
const MAX_RAW_FINDINGS = 50;

/**
 * Stable hash of the sanitized manifestation, for novelty detection. Keys on the
 * same fields the issue body renders (whatHappened + whyFriction + repro), so a
 * genuinely new repro/cause with the same symptom still counts as a new shape.
 */
export function manifestationKey(finding: Finding): string {
  return shortHash([finding.whatHappened, finding.whyFriction, finding.repro].join('\n'));
}

/**
 * Per-wall drop counts (PNZM3B): silence must mean clean, not secretly lossy.
 * `MAX_RAW_FINDINGS` overflow is deliberately excluded — an anti-abuse ceiling
 * unreachable by legitimate sessions (waiver recorded in the ticket).
 */
export interface EncounterReport {
  encounters: Encounter[];
  drops: { schema: number; surface: number };
}

/**
 * Turn raw agent findings into sanitized, fail-closed encounters ready to file,
 * reporting what each egress wall dropped. Async because the egress scrub
 * (`sanitizeTextDeep`) runs the secretlint pass.
 */
export async function prepareEncounters(rawFindings: readonly unknown[]): Promise<EncounterReport> {
  const encounters: Encounter[] = [];
  const drops = { schema: 0, surface: 0 };

  for (const raw of rawFindings.slice(0, MAX_RAW_FINDINGS)) {
    const finding = normalizeFinding(raw);
    if (!finding) {
      drops.schema += 1;
      continue;
    }

    const surface = resolveSurface(finding.safewordSurface);
    if (surface === undefined) {
      drops.surface += 1;
      continue;
    }

    const [title, whatHappened, whyFriction, repro] = await Promise.all([
      sanitizeTextDeep(finding.title),
      sanitizeTextDeep(finding.whatHappened),
      sanitizeTextDeep(finding.whyFriction),
      sanitizeTextDeep(finding.repro),
    ]);
    const sanitized: Finding = {
      category: finding.category,
      title,
      safewordSurface: surface,
      whatHappened,
      whyFriction,
      repro,
    };

    encounters.push({ draft: buildDraft(sanitized), manifestation: manifestationKey(sanitized) });
  }

  return { encounters, drops };
}
