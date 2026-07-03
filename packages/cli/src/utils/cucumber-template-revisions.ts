/**
 * SHA-256 hashes of every shipped revision of
 * `templates/cucumber/cucumber.mjs` (ticket 56JCFZ). Harness detection
 * treats a root `cucumber.mjs` matching ANY of these as safeword's own
 * scaffold — an install from an older safeword must never be mistaken for a
 * host cucumber harness at upgrade.
 *
 * MAINTENANCE: when the template changes, append the hash of the NEW content
 * (`sha256sum packages/cli/templates/cucumber/cucumber.mjs`). A contract
 * test (cucumber-template-revisions.test.ts) fails when the current
 * template's hash is missing, so this list cannot silently rot.
 *
 * History source: `git log --follow -- packages/cli/templates/cucumber/cucumber.mjs`,
 * one entry per distinct content (oldest first).
 */

import { createHash } from 'node:crypto';

export const CUCUMBER_TEMPLATE_REVISION_HASHES: ReadonlySet<string> = new Set([
  // f11d63b2 — 102a initial lane config (root features/ only)
  '1a9a1bd23c1f7b249800a631e4f3d59abc24678b9bcb1a21891a95378dbadc58',
  // a874ea92 — VM78NC workspace feature paths
  '761b20d508207b58e234fdcf592ae4cd0e916548ef46177469e2165c1e13832b',
  // 4b3aefd4 — CLI feature-path passthrough
  '3d22842f73c62e497a525dbe0a126b42bf2202fb8369ede29ba45b6d1e493fb6',
  // 56JCFZ — runtime paths.features/paths.steps config read (current)
  'be41addbe682362085c65476308cb91f6070f65f7314038468f2093bdc0b0b0a',
]);

/** True when `content` is a shipped revision of safeword's lane template. */
export function isShippedCucumberTemplateRevision(content: string): boolean {
  const hash = createHash('sha256').update(content).digest('hex');
  return CUCUMBER_TEMPLATE_REVISION_HASHES.has(hash);
}
