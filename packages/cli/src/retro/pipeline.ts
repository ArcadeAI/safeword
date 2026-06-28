// The friction → safe-encounter pipeline. This is where every egress wall is
// composed, in order, before anything can be filed:
//   1. normalizeFinding  — schema wall (drop off-schema fields / bad shape)
//   2. resolveSurface    — fail closed if the surface isn't a real safeword path
//   3. sanitizeText      — deny-by-default scrub of every free-text field
//   4. buildDraft        — code-assembled body from the sanitized fields only
// The result is an Encounter ready for triage. Reusable across retro's
// front-ends (transcript miner now; a future `safeword report` later).

import { buildDraft } from './draft.js';
import { resolveSurface, sanitizeText } from './egress.js';
import { type Finding, normalizeFinding } from './finding.js';
import { shortHash } from './hash.js';
import type { Encounter } from './triage.js';

/**
 * Stable hash of the sanitized manifestation, for novelty detection. Keys on the
 * same fields the issue body renders (whatHappened + whyFriction + repro), so a
 * genuinely new repro/cause with the same symptom still counts as a new shape.
 */
export function manifestationKey(finding: Finding): string {
  return shortHash([finding.whatHappened, finding.whyFriction, finding.repro].join('\n'));
}

/** Turn raw agent findings into sanitized, fail-closed encounters ready to file. */
export function prepareEncounters(rawFindings: readonly unknown[]): Encounter[] {
  const encounters: Encounter[] = [];

  for (const raw of rawFindings) {
    const finding = normalizeFinding(raw);
    if (!finding) continue;

    const surface = resolveSurface(finding.safewordSurface);
    if (surface === undefined) continue;

    const sanitized: Finding = {
      category: finding.category,
      title: sanitizeText(finding.title),
      safewordSurface: surface,
      whatHappened: sanitizeText(finding.whatHappened),
      whyFriction: sanitizeText(finding.whyFriction),
      repro: sanitizeText(finding.repro),
    };

    encounters.push({ draft: buildDraft(sanitized), manifestation: manifestationKey(sanitized) });
  }

  return encounters;
}
