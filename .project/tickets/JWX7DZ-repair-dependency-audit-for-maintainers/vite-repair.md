# Keep the dependency audit green before merge

At source head ea9b8288c, all hosted CI had passed, then a fresh pre-merge audit
failed on newly listed Vite GHSA-587h-7wmj-h5pm. No merge was attempted. The user
authorized an administrative merge of PR 5996 after green CI; this authority is
still unconsumed. PR 5994 is only to be updated and tested after that merge.

## Bounded repair

Add a root override for Vite 8.2.4, matching the existing security-override pattern.
Keep markdown-it at 14.3.3. Do not change audit ignores, template contracts,
canonical policy, scenario source, generated carriers or #5086 fallback work.
Vite's required Rolldown range moves from ~1.2.1 to ~1.2.4, so Bun resolves 1.2.14
and its matching native bindings/types. These are required transitive patches,
not a general update. The complete incremental lock delta is vite-lockfile.diff.

Updated lockfile SHA-256:
`be18ed22e67790dd2ef6b3736ac4bfd2bf436d9ca0dc5bb04a16ea82888da4eb`.

## Primary sources checked in this run

- Vendor advisory: <https://github.com/vitejs/launch-editor/security/advisories/GHSA-587h-7wmj-h5pm>.
  Vite 8.2.0 through 8.2.3 are affected; 8.2.4 is fixed on that line. The vendor
  describes Windows-only impact. This patch does not claim a Windows exploit
  reproduction or native qualification; it repairs dependency resolution and
  audit policy. The launch-editor fix is bundled in the named fixed Vite release.
- `npm view vite@8.2.4 version dist.integrity dependencies --json` reports the
  fixed version and integrity
  `sha512-lfauXnrf2x0p+UoA+wXh0dgFWnUjCyG6Js95KBkgaCwUU9k0DAHI4W6Q0WCx+h+5g+Alce1y4Zi2QjjK0UvGBw==`.
  It requires Rolldown ~1.2.4 and PostCSS ^8.5.26. The repository's existing
  PostCSS 8.5.23 override is retained; it already overrode the previous Vite's
  ^8.5.25 range. This inherited range mismatch is a contrary observation, not
  a newly asserted compatibility guarantee. Real Vitest and website checks run.

## Observed proof and limits

- `vite-pre-merge-red.log`: exact policy audit exit 1 before repair, with original
  ignores and source/lock identities retained.
- `vite-audit-green.log`: same command/ignores exit 0 after repair, with updated
  lockfile hash. Unfiltered audit still has seven inherited findings (2 high,
  2 moderate, 3 low); no new ignore or full-security-clearance claim.
- Forced pinned frozen install completed before tests began. Actual Vitest and
  Astro consumers both resolve 8.2.4; raw paths/versions are retained in
  vite-consumer-resolution.log. Earlier stale-install observations are preserved.
- Full pinned tests, root lint and website build are running; no passing result
  is claimed here yet. No new test implementation is needed for this version-only
  repair; existing audit RED/GREEN and real consumer checks discriminate it.
- The prior phase-wide review limit remains: gzip logs cannot be review targets,
  and the complete lockfile is too large for the service. This independent
  material review targets package.json plus the exact incremental lock delta and
  this record; do not describe it as whole-branch review.
- Reopening from done was itself gated on an approving done-phase review, while
  review 6cdebf3a required reopening as the correction. The documented backward
  transition exception was recorded for that purpose; fresh intake review
  42f0f689 approved and its normal stamp succeeded. No review policy changed.
- Old verify.md is explicitly marked superseded. Earlier successes, failures,
  deferrals and review limitations remain historical evidence rather than being
  overwritten as current clearance.

After tests and independent review, reconcile verification and closure, push the
current head, wait for CI, rerun the exact audit immediately before admin merge,
then update only PR 5994 from main and test it. Do not merge PR 5994.
