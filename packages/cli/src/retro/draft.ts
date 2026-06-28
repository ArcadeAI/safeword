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

/** `retro:<12-hex>` keyed on the stable finding identity. */
export function retroSignature(finding: Finding): string {
  const key = [finding.category, finding.safewordSurface, normalizeForKey(finding.title)].join(':');
  return `retro:${shortHash(key)}`;
}

/** Build the namespaced draft from a normalized finding. */
export function buildDraft(finding: Finding): RetroDraft {
  return {
    signature: retroSignature(finding),
    title: finding.title,
    body: assembleBody(finding),
    labels: ['self-report', 'retro', finding.category],
  };
}
