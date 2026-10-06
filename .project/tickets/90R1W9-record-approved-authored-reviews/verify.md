# Verification report

## Local candidate activation — 2026-10-06 UTC

The supported Codex installer now registers this worktree's marketplace and
installs its generated Safeword plugin into the actual shared profile. Codex
required removal of the old marketplace registration before adding this local
source; the plugin remained installed throughout marketplace replacement.
`codex plugin add safeword@safeword --json` completed successfully. Installed
and generated runtime SHA-256 are both
`b281fe1bc7ece3f7b9c238753fd7a7bbe56ebca499ebdfe857616e1e1569456a`.
Both distributions retain version 1.0.0. No cache files, receipts, approval
ledger lines or guards were manually edited. This supersedes the active-profile
blocker below; fresh independent review and normal guarded transitions still
must prove closure. Official installation guidance:
<https://developers.openai.com/plugins/build/plugins>.

## Current verification — 2026-10-05 local / 2026-10-06 UTC

Resumed `codex/approval-exclusions` at `862bdfba4e35d861bb48ac03c81dd3c9a38d8b5f`.
The installed recorder logged `verify ✓` for the actual current Codex run. The
skill's verbatim shell block ran with Bun 1.3.14 and Node 26.8.1; no assertion
or product code changed.

### Verify Checklist

**Test Suite:** ✓ 10,456/10,456 CLI tests pass in each of two full runs (609 files, 14 expected skips each); relay 198/198 passes with one expected skip; collector 153/153 passes twice. Earlier wrong-Bun and fake-reviewer deadline failures did not recur.
**Gherkin:** ✅ Acceptance passes twice — 596/596 scenarios and 11,118/11,118 steps each. Both dedicated proof calls were refused by another chat's shared test lock before tests started; the same command subsequently passed 47/47 with the wrapper's supported longer wait, without removing or bypassing the lock.
**Build:** ✅ Success — all resolved entries, including the website.
**Lint:** ✅ Clean — root lint, Gherkin lint and CLI typecheck passed after acceptance cleanup. The first concurrent lint invocation encountered ENOENT when a temporary `.safeword-coverage-bin-*` fixture was removed; it was not called green.
**Typecheck:** ✅ Clean — all resolved entries, including Astro and Python.
**Scenarios:** ⏭️ Skipped — investigated bug task has no feature ledger; process-assessment.md records its observable proof matrix.
**Refactor:** ✅ No change warranted — existing packet identity, classifier and path normalizer remain authoritative.
**PR Scope:** ✅ Diff matches ticket scope — complete source/test/docs diff inspected; generated carriers contain the scoped change and lifecycle result hashes remain unchanged. Historical #2121 proofs were not changed.
**Dep Drift:** ✅ No new architectural dependency — source-map-js resolution and its root override are already inherited from current main; rendering and shipped lint tools are existing choices.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation.
**Experience:** ✅ Actual shared-profile recorder accepted independent review `53a9e548-0918-46f6-9ecb-df081c8c67fa` and earned the implement stamp. The live guarded ticket edit advanced implement → verify. Installed candidate positive/negative walkthrough below also rejects uncovered authored work. The fix adds zero user steps.
**Surface Evidence:** ✅ Source CLI, public envelope, generated delivery, supported installed candidate and actual shared-profile recording have proof. All five generated surfaces are current.
**Evidence limits:** ⚠️ Canonical aggregate exited 75 from proof-lock contention despite green full suites and acceptance; the separate proof recheck passed. Raw scans remain non-green: nine JavaScript advisories (two high, four moderate, three low), and six urllib3 advisories from root uv audit. The two high JavaScript findings remain user-deferred under inherited CI policy. GEPA requirements pip-audit and Go's scanner reported no findings. No new ignore or dependency upgrade was added.

Audit passed for the unchanged implementation scope with the limits in audit.md.
Exact-head CI [37418723375](https://github.com/ArcadeAI/safeword/actions/runs/37418723375)
is terminal green, including both Node lanes. Local logs:
`/tmp/5443-closure-verify.log`, `/tmp/5443-closure-proof-recheck.log`,
`/tmp/5443-closure-lint-final.log`, `/tmp/5443-closure-generated.log`.
The raw scan no longer reports the patched source-map-js advisory.

### Earlier closure attempt — superseded by local activation above

Before this report update, review `35ee3248-47c8-431e-aa74-9be0a152aff0` was
authenticated approved with both runtime bundles in `review_excluded_targets`.
The installed recorder and normal repository `bun run safeword` recorder both
rejected implement coverage because their distribution-owned stable receipt
route lacks that field. Read-time verification also refuses the earlier ledger
stamp. Safeword denied the actual implement-to-verify ticket edit; phase/status
remain implement/in_progress.

The shared marketplace points at worktree `4951`, rather than this branch. The
active runtime hash differs; the supported isolated candidate and this branch's
generated runtime both hash to
`b281fe1bc7ece3f7b9c238753fd7a7bbe56ebca499ebdfe857616e1e1569456a`.
No active-profile cache, identity, receipt, approval line or guard was edited.
Configured GitHub Draft inspection returned a `noop`, not a model review.
PR #5443 remains Draft. Supported local candidate activation and restart await
the shared-profile choice; this new report requires fresh artifact review before
subsequent phase advancement, rather than carrying the earlier approval forward.

**Next:** Resolve supported candidate activation, then earn fresh review and use
normal stamp/verify/done transitions before Ready promotion and actual configured
inspection. Do not merge, release, bypass guards or change #2121 proofs.

## Current guarded closure evidence

Independent Claude/Opus review `53a9e548-0918-46f6-9ecb-df081c8c67fa`
approved the full packet with no errors. The actual installed distribution's
normal `project runtime write-review-stamp` earned the implement stamp and the
live PreToolUse guard accepted implement → verify. No restart or alternate
verifier route was used. The earlier blocked attempts above are historical.
Review warnings are answered: stale status sections are explicitly historical;
tampering tests prove integrity rejection, while separate signed unclassified
exclusion tests prove classification enforcement. Generated content freshness
and status-first rejection remain deliberate documented boundaries.

Independent Claude/Opus review `eb4c864e-e146-40d5-ac2e-11987c8ca1f3`
approved the verification packet with no errors. The normal installed writer
earned the verify-phase stamp; the live guard accepted phase done and status
done. No product code changed during closure. The source-map-js root override
is inherited from main, as detailed in the main synchronization history below.

**Next:** Commit/push the closure evidence, await current-head CI, mark PR #5443
Ready and inspect the configured review. Do not merge or release.

## Historical verification record — prior states and next steps are superseded

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: the complete resolved plan ran two CLI suites under a child PATH selecting Bun 1.4.0 instead of required 1.3.14; 8 generator failures reproduced that explicit version refusal. A second pass also hit one 500ms fake-reviewer deadline assertion. Explicit pinned Bun/Node rerun of all three affected files passed 145/145 tests. Prior frozen production suite passed 10,453 CLI tests; production bytes remain unchanged by this acceptance-fixture/report follow-up. Relay 198/198 and collector 153/153 passed.
**Gherkin:** ✅ Acceptance lane passes — both resolved runs passed 596/596 scenarios and 11,118/11,118 steps; BDD proof 47/47 passed.
**Build:** ✅ Success — complete resolved build plan, including website and detected language projects.
**Lint:** ✅ Clean — root lint and Gherkin lint passed.
**Typecheck:** ✅ Clean — complete resolved typecheck plan, including Astro and Python, passed.
**Scenarios:** ⏭️ Skipped — investigated bug task has no feature scenario ledger; its observable proof matrix is in process-assessment.md. Existing acceptance scenarios were corrected, not newly authored feature behavior.
**Refactor:** ✅ No change warranted — existing packet identity, classifier and normalizer remain authoritative; separate assessment records the rationale.
**PR Scope:** ✅ Diff matches ticket scope — verified exclusion transport, exact authored coverage, coordinator classification and generated delivery; current follow-up repairs the resulting exact-key acceptance contract and records process evidence.
**Dep Drift:** ⚠️ Existing supply-chain scans reported 10 JavaScript advisories (3 high, 4 moderate, 3 low) and 6 urllib3 2.7.0 advisories in the Python experiment. The earlier approval fix changed no manifests or lockfiles; the later authorized source-map-js lockfile patch below removes that advisory. This remains an unclean dependency scan; unrelated upgrades were not applied.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — existing authenticated coordinator receipt and exact-file coverage mechanisms reused.
**Experience:** ⚠️ Installed 1.0.0 still rejects the valid implement stamp until this fix is deployed. Walked developer through review → receipt → recording using the real source CLI integration; worst step = deployed recorder rejects the generated exclusion; new steps vs before = 0 in the fixed source flow. No killer demo declared for this bug task.
**Surface Evidence:** ⚠️ Source CLI and generated bundle status proof recorded; installed native activation remains unproven and unchanged.
**Evidence limits:** ⚠️ Wrong Bun selected in initial child process and one full-load fake-reviewer deadline failure; all affected files passed with explicitly pinned tools in isolation. Installed 1.0.0 approval-recording limitation remains; no stamp was fabricated or guard bypassed.

Audit passed for the PR-scoped source, dependency boundaries, references and documentation, with the coverage limits in audit.md. Its concrete finding was four obsolete exact-key acceptance expectations; those were fixed without weakening strict equality.

## Surface evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Source review status → receipt → implement gate | Real CLI integration and coordinator/reader/gate regressions | Passed in frozen production suite and targeted 259/259 contract checks |
| Public machine envelope | Full Cucumber acceptance plus schema tests | 596 scenarios / 11,118 steps passed twice |
| Generated plugin runtime | Real approved job queried with regenerated bundled CLI | Approved with verified exclusion field; installed 1.0.0 lacked field |
| Codex/Claude installed approval recorder | Normal installed implement stamp attempt | Failed honestly; requires deployment, not bypassed |

## Commands and durable evidence

The installed verify invocation recorder printed `verify ✓`. The skill's exact
shell block ran from this worktree; its aggregate exited 1, so this report does
not claim an all-green verify verdict. Logs: `/tmp/approval-exclusions-process-verify-final.log`,
`/tmp/approval-exclusions-toolchain-recheck.log`, and the prior evidence named in
ticket.md. Local logs are ephemeral; fresh current-head CI is the durable proof.

Fast smoke passed 101 files / 2,139 tests in
`/tmp/approval-exclusions-process-smoke.log`. Final lint, all five generated
surfaces, 268 parity pairs / 11 contracts, and version-sync passed. Independent
review 70bc740d-3c79-4694-b970-94188d8ac043 approved this scoped follow-up with no
errors.

## Review warning responses

Acceptance exact-key assertions prove public field presence, not authorization;
separate real coordinator/reader/gate tests prove classification, freshness and
coverage. Publishing the field on an exhausted result grants no approval:
receiptGateVerdict rejects every non-approved status before accepting coverage.
The existing outline title is historical wording and was left outside this
minimal expected-data repair. No full-suite pass after this fixture change is
invented; its complete acceptance lane and the actual failed/resolved runs are
reported above.

The invocation recorder writes that the skill was invoked, not the shell
aggregate's result; its successful invocation is not a verification pass. The
aggregate failure is recorded explicitly above. The timing-sensitive fake route
test is recorded for follow-up: its 500ms startup deadline can turn an expected
process_failed into timed_out under full load. Keep the assertion intact and
investigate that fixture separately if fresh CI reproduces it. Deployment and
fresh CI remain required; the review does not grant Ready promotion.

**Next:** Push the reviewed scoped follow-up and inspect fresh CI. Keep the PR Draft and ticket in implement; deployment and the normal installed approval stamp remain outstanding.

## Source-map dependency security follow-up

User authorized the smallest patched source-map-js update after CI reported
GHSA-68fv-2mgg-jv7q. The advisory identifies versions before 1.2.2 as vulnerable
to event-loop denial of service through indexed source-map section offsets.
Registry latest and integrity were verified against npm; bun.lock now resolves
1.2.2 instead of 1.2.1. All existing consumer ranges accept this patch, so no
direct dependency, override, manifest change, or unrelated upgrade was added.

Pinned Bun 1.3.14 frozen installation accepted the lockfile. A force frozen
install refreshed stale local consumer links; all five installed consuming
packages (PostCSS, both css-tree versions, @eslint/css-tree and magicast) resolve
1.2.2. Unreferenced old install cache bytes are not dependency resolution.

Before/after audit is the genuine regression evidence for this dependency-only
change; no fabricated source RED test is claimed. The source-map-js advisory is
absent afterward, but audit remains non-green with two unrelated high findings:
http-cache-semantics GHSA-ch52-4w7c-c8xp and braces GHSA-vfj7-8cjw-p6xm. They
remain outside this explicitly narrow update. Logs:
/tmp/5443-source-map-audit-before.log and
/tmp/5443-source-map-audit-final.log.

Affected CLI/relay/collector source-map builds and the Astro website production
build passed after refreshing the dependency links. Release packaging passed
13 files / 81 tests. Logs: /tmp/5443-source-map-build-final.log,
/tmp/5443-source-map-website-final.log, /tmp/5443-source-map-release-final.log.
Independent dependency review approved the single lock entry, compatible ranges,
registry integrity and honest remaining audit blockers. No production source,
generated template bytes, historical scenario claims, installed approval stamp,
or release state changed. Fresh CI remains required and the PR remains Draft.

Sources: [reviewed advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [upstream patch release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2).

Final root lint, Gherkin lint and CLI typecheck passed with pinned Bun 1.3.14 and actual Node 26.8.1 (/tmp/5443-source-map-lint-node-final.log). The initial Bun-as-Node PATH failed node:sqlite resolution; no source assertions were changed. All five generated surfaces remain current (/tmp/5443-source-map-generated.log).

## Main synchronization and installed-candidate walkthrough

Exact c6d4045c5 CI 37414245531 completed success for all ordinary jobs. Its
audit command explicitly ignores GHSA-vfj7-8cjw-p6xm and GHSA-ch52-4w7c-c8xp
under inherited commit 541efd82a policy. Raw local audit still reports those
two advisories; the user deferred them, and source-map-js is genuinely patched.
No zero-advisory claim or new ignore rule is made.

Main 798facfd59bbbef91381ce8cdc06c37c67f4ed2f introduced only generated
conflicts with this branch. Normal additive merge preserves its readiness guard
fix. All five surfaces were regenerated by their generators; no bundle was
hand-edited. Combined targeted receipt/job/readiness tests passed 254/254.

Built and packed this candidate, installed the tarball into a disposable project,
and installed its native plugin through supported Codex marketplace/add commands
under isolated CODEX_HOME=/tmp/5443-native-candidate-profile. The user's actual
profile was unchanged. Local candidate packaging is not publication. Initial
enrollment reported a missing safeword dependency; a standard dev-dependency
tarball install corrected that declaration, without changing product code.

A genuine separate Claude review d00673ae-92bc-4803-812e-43cf08361b58
approved the disposable authored.md and excluded oversized generated.js. The
installed public CLI's normal project runtime write-review-stamp command recorded
phase implement successfully using the real host CODEX_THREAD_ID. Adding an
unreviewed authored file and repeating that command failed coverage; the log
remained one stamp. No receipt, identity or approval line was fabricated.

Logs: /tmp/5443-candidate-stamp-isolated.log and
/tmp/5443-candidate-stamp-negative.log; installer receipts
/tmp/5443-candidate-marketplace.json and /tmp/5443-candidate-plugin.json. This
proves the supported installed-candidate recording boundary, not a real #5018
closeout or activation of the user's profile. User-installed stable 1.0.0 still
needs delivery of the fix. Fresh merged-head CI/review remain required.

Combined candidate release packaging passed 81/81; root lint/Gherkin/typecheck and all five generated surfaces passed. Logs: /tmp/5443-synced-release.log, /tmp/5443-synced-lint.log, /tmp/5443-main-sync-generated.log. No repeated whole-suite local pass is claimed for this additive main synchronization; its scoped tests and fresh CI provide current combined evidence.

Latest additive main synchronization also includes ad937bc450a0220df72e54f978ef3525a1686323 and its accepted source-map-js 1.2.2 root override/ticket. That policy is inherited from main, not a new override introduced by this approval fix. Frozen install and all five generated-surface checks passed; production templates are unchanged by that second merge. Final independent inspection and exact new-head CI are pending.
