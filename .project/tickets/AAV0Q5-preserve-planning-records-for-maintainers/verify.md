# Preservation delivery verification

## Verify Checklist

Complete packaged verification ran against main-based preservation work and
exited **1**, solely because the raw Bun dependency audit now reports two
Astro advisories inherited from main. No passing aggregate invocation or
completed delivery is claimed. Ordinary record edits during this run changed
no production code; exact-head CI remains separate evidence.

**Test Suite:** ✓ 11648/11648 tests pass in each of two CLI passes, 724 files and 14 skipped each. Relay 198 pass / 1 skip; collector 153 pass. Repeated counts overlap and are not added.
**Gherkin:** ✅ Acceptance lane passes — 599 scenarios / 11786 steps plus 52 proof checks. The runner excludes @wip; the archived EP9 scenarios receive no execution credit.
**Build:** ✅ Success — all resolved workspace builds, including website.
**Lint:** ✅ Changed Markdown/JSON formatting and Markdown/Gherkin lint pass; CI lint passes on d2c69169a.
**Typecheck:** ✅ All resolved TypeScript/Python checks and website diagnostics pass.
**Scenarios:** ⏭️ Preservation patch, no new application behavior. Historical feature remains @wip and all 52 ledger rows remain unchecked.
**Refactor:** ✅ No change warranted — records and labels only, no implementation to restructure.
**PR Scope:** ✅ Only the historical 5GK1CN packet, its wip feature source, epic evidence/handoff and this preservation delivery's records. No old implementation, package, hook, template, generated bundle, route or converter dependency change.
**Dep Drift:** ❌ Bun audit: inherited astro 7.3.5 has two findings, one moderate and one low. Python audits pass (uv: 39 packages); Go has zero reachable vulnerabilities with 1 imported/14 module notices retained. No audit waiver or scanner-policy change.
**Parent Epic:** #4200 remains incomplete. No original scenario, missing RED or 33-case deferral changed.
**Reconcile:** ✅ No new implementation pattern or architecture decision.
**Experience:** ⏭️ Records preservation, no new product flow or user-study claim.
**Surface Evidence:** ✅ JSON parsing, Gherkin lint, unchanged source comparison and explicit historical/current framing checked. No native-host or qualified recovery proof claimed.
**Evidence limits:** ⚠️ Full verification exits 1 despite passing application checks. Earlier implementation/qualification statements remain bound to their historical source, not current main.

## Preservation checks

The byte-equality check covers only the original 5GK1CN folder and its feature
source at local source commit c03964335, excluding the newly added
PRESERVATION.md. All 26 original source files match. It does not claim that
new delivery records or intentionally updated epic handoff labels existed in
that source commit. All 13 preserved evidence JSON files parse; known
credential-token/private-key patterns were not found. Local evidence paths are
retained as locators, not authentication files.

Archive/diff audit passed. Automatic ticket selection encountered the three
changed ticket files; the supported explicit --ticket AAV0Q5 selector resolved
the preservation delivery. It has no implementation plan, so its principle
trace check is not applicable. No configuration or selector policy was changed.

Independent cross-agent Claude review 80de6945-77aa-4c8f-948e-ccaaa2ccc633
approved all 33 changed files without exclusions or errors. Earlier approvals
9bf71921, b705e3de and partial-packet 899409db remain recorded. The partial
packet correctly failed the implement-coverage stamp; the full packet earned
the actual implement stamp before this task entered verify. Model reported by
the coordinator is alias opus, not a verified full model ID.

## Actual blocker and separate proposal

The dependency findings are GHSA-mh32-jxcr-mh9f and GHSA-r3h5-4585-7x3w.
Official advisories fix both at Astro 7.4.7 or later. Existing website range
^7.3.5 accepts that version; no out-of-range override is necessary. CI's
configured audit threshold can pass while the full raw local audit fails;
neither result replaces the other.

A separate, unpublished worktree codex/4200-astro-audit-repair first tested
an Astro-only candidate. Its audit/build/typecheck passed, but independent
review 025564ef requested changes: root Vite 8.2.4 and Zod 4.6.6 overrides were
below the newer Astro's declared minima. That rejection remains preserved;
passing a website build did not make the forced ranges supported.

The corrected three-file candidate sets website Astro 7.4.7, root Vite 8.3.5
and root Zod 4.6.7 with the resulting lockfile graph. Raw audit, website build,
website typecheck, all three workspace TypeScript checks and the existing
Vitest dependency-compatibility smoke pass. All five generated surfaces remain
current without edits. Independent cross-agent review c59ee74c approves;
duplicate transitive versions remain nonblocking warnings, not extra updates.
The site does not pass Satteri AST objects across versions; its only source
reference is the existing SSR externalization setting.

This candidate has not been included in the records-only PR, published as
another PR or merged. Publishing a separate dependency-fix PR needs explicit
authority. Existing bulk Dependabot PR #7235 also updates Astro but changes
32 other dependencies; it was not adopted as this narrow repair.

Keep this delivery at verify/in_progress and PR #7368 Draft until the audit
blocker is resolved. Normal merge also needs GitHub's required human review;
the earlier admin authority applied to #7190 and is already consumed. Keep
converter dependencies unchanged as the user requested. No qualification,
release, route change, new feature approval or cleanup is authorized here.

Raw logs: /tmp/AAV0Q5-verify.log, /tmp/AAV0Q5-audit.log,
/tmp/AAV0Q5-complete-review.json and /tmp/AAV0Q5-preservation-checks.json,
with permanent copies under the existing safeword-trials archive.
