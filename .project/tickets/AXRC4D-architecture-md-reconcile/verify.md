# Verify: reconcile ARCHITECTURE.md against the generated doc (AXRC4D)

## Verify checklist

**Test Suite:** ✅ 15 unit + git-integration tests for the done-gate nudge
(`tests/hooks/architecture-document-nudge.test.ts`) green; full hooks+integration
suite green (118 files, 1910 tests) including every E2E done-gate test that spawns
the deployed stop hook.
**Gherkin:** ⏭️ N/A — both surfaces are a hook (no CLI/agent acceptance surface) and
a skill-prompt sharpening; the executable acceptance is the deterministic nudge's
unit + git-backed integration tests (safeword tests done-gate behavior via
integration/unit, not cucumber).
**Build:** ✅ `tsup` build succeeds; the new hook lib is in the setup manifest so
`safeword setup` deploys it (without it the spawned hook crashed — caught and fixed).
**Lint:** ✅ eslint clean (the test renamed to `architecture-document-nudge`/
`architectureDocumentNudge` per `unicorn/name-replacements`).
**Scenarios:** All ledger items [x]; the load-bearing no-false-alarm branch
(unresolvable baseline → no nudge) added as an executable test per the independent
review.
**Dep Drift:** ✅ Zero new dependencies (the helper uses node:child_process / node:fs).
**PR Scope:** ✅ Diff matches scope — the nudge helper + its tests, the done-gate
wiring in `stop-quality.ts` (both copies), the setup manifest entry in `schema.ts`,
the `/audit` ARCHITECTURE.md sharpening (3 skill copies), and the ticket artifacts.
No piggybacked changes.
**Scope fidelity:** ✅ No new deterministic source-analyzing drift module and no
managed region — the nudge READS the existing recorded fingerprint (a cheap trigger)
and the `/audit` change READS the generated doc; both report-only / non-blocking.

## Evidence

- **Independent design review** (fresh-context agent): **PASS-WITH-NITS**, one
  load-bearing finding — the "unresolvable baseline (no upstream / detached HEAD) →
  no nudge" fail-closed branch was correct but untested. **Addressed:** added the
  `upstream: false` harness case asserting `null` even when the fingerprint moved.
  Confirmed: scope fidelity (reuses the recorded fingerprint, not a source detector);
  non-blocking wiring (ticket is marked done before the nudge fires, no double-emit);
  the three `/audit` skill copies (`templates`/`.claude`/`.agents`) in sync with
  E003/W008/W009; the git harness genuinely exercises `git show <merge-base>:…`.
- **Known, accepted over-fire (documented in the PR):** on a monorepo,
  `monorepoFingerprint` also covers inter-package edges + boundary config + the
  unreadable-workspace set, so an edge-only or boundary-only change nudges even with
  no module added/removed. Acceptable by design — the nudge is advisory, and an edge
  change can legitimately stale the narrative; over-firing a one-liner is the correct
  failure direction. On a repo's default branch (no upstream) the nudge is inert
  (fail-closed beats false alarm).

## Quality review (post-merge-prep, /quality-review)

Fresh-context independent review returned **APPROVE** (no critical/blocking items;
scope fidelity, non-blocking wiring, and the report-only audit sharpening all sound).
Two non-blocking follow-ups raised — one addressed, one justified:

- **Addressed — parser drift guard.** `parseGeneratedFingerprint` re-implements the
  CLI's `readDocumentFingerprint` (the hook-standalone duplication pattern, like
  `namespace-root.ts`) but had no differential test. Added
  `architecture-document-nudge-parity.test.ts` (P58R22 pattern): both readers must
  agree on 9 fixtures incl. CRLF, empty value, no-frontmatter, a fingerprint-looking
  body line outside the fences, and unterminated frontmatter. Pins the format contract.
- **Justified — done-gate end-to-end nudge wiring.** The reviewer noted the 3-line
  glue in `stop-quality.ts` (prepend-on-navigate / emit-on-all-done) has no E2E test.
  The nudge *decision* is covered end-to-end by the git-backed integration tests (real
  `git show <merge-base>:…`), and the deployment manifest entry by `schema.test.ts`; the
  remaining glue is a 3-line prepend over that tested helper. A full done-gate E2E that
  fires the nudge would need a passing-done fixture WITH an upstream-tracking branch and a
  moved generated-doc fingerprint — high fixture cost for marginal coverage over the
  real-git helper test. Justified-absent per the wiring gate.

Provenance: the generated-doc frontmatter format claim is `verified` against the
writer (`renderDocument` in `architecture-document.ts`) this session; the parser-parity
is now machine-enforced. No external dependencies.

## Reconcile

The implementation matches the spec: two surfaces, no new deterministic drift module
and no managed region. The nudge reuses the recorded `fingerprint:` (shapeFingerprint
/ monorepoFingerprint output) as a cheap trigger; `/audit` reads the generated doc's
`### <name>` units as structural ground truth. A net-new hook lib file required a
`schema.ts` setup-manifest entry (so `safeword setup` deploys it) and a rebuild — both
done; the E2E suite that spawns the deployed hook is green.
