// Retro draft + signature.
//
// A draft is the `{signature, title, body, labels}` shape the existing filing
// flow already understands (self-report.ts SelfReportIssueDraft). The signature
// is `retro:`-namespaced so it can NEVER collide with a deterministic spool
// signature (`<agent>:<class>@<source>` from signatureOf) — that prefix is the
// structural no-double-filing guarantee (SM1.AC1). The hash keys on the stable
// finding identity (category + surface + normalized title) so the same friction
// recurring across sessions resolves to the same signature.

import { assembleBody, type Finding } from './finding.js';
import { shortHash } from './hash.js';

export interface RetroDraft {
  signature: string;
  title: string;
  body: string;
  labels: string[];
}

/** Lowercase + whitespace-collapse so trivial phrasing differences don't fork the id. */
function normalizeForKey(value: string): string {
  return value.toLowerCase().replaceAll(/\s+/g, ' ').trim();
}

/** The tracker label shared by filing (applied) and reconcile (queried). */
export const RETRO_LABEL = 'retro';

/** `retro:<12-hex>` keyed on the stable finding identity. */
export function retroSignature(finding: Finding): string {
  const key = [finding.category, finding.safewordSurface, normalizeForKey(finding.title)].join(':');
  return `retro:${shortHash(key)}`;
}

/**
 * A hidden, searchable marker that carries the content signature into the issue
 * body. Dedupe matches on THIS (via `searchBySignature` → `in:body`), not the
 * model-generated title, because titles vary across delta re-fires (ZFGWS1). An
 * HTML comment keeps it invisible in the rendered issue but present in the raw body
 * GitHub search indexes.
 */
export function signatureMarker(signature: string): string {
  return `<!-- safeword-retro-signature: ${signature} -->`;
}

/** The tracker label marking process-level (no single-file) friction (PNZM3B). */
export const PROCESS_LABEL = 'process';

/** Build the namespaced draft from a normalized finding. */
export function buildDraft(finding: Finding): RetroDraft {
  const signature = retroSignature(finding);
  const processLabel = finding.safewordSurface.startsWith('process/') ? [PROCESS_LABEL] : [];
  return {
    signature,
    title: finding.title,
    // Embed the signature marker so re-fires (and recurrences) dedupe on the
    // stable signature, not the variable title.
    body: `${assembleBody(finding)}\n${signatureMarker(signature)}`,
    labels: ['self-report', RETRO_LABEL, finding.category, ...processLabel],
  };
}
