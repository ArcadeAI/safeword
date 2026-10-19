# Bounded #5041 closing verification

Source/test revision: `3916e6401dd80a0f23e943590303ee49174ea80e`, with the
architecture-only repair `6d608f125`, based on main
`172aac2c85d8197344b68ff9ece769a283f6f7f6`. This record covers the remaining work
from #5041 and authorized test-review repairs. It does not close the
parent feature, absorb #5051, replace historical evidence, or authorize Ready,
merge or promotion. The installed helpers reported `verify ✓` and `audit ✓`.

## Verify Checklist

**Test Suite:** ❌ The root rerun retains two relay failures (196 passed / two failed / one skipped); both passed unchanged in isolation, with cause unestablished. Final direct CLI suite passed all 688 files: 11351 passed / 14 skipped (11365 total), 828.89 seconds. Collector passed 153/153. Go's test command exited 0 with no test files. Earlier relay run passed 198 with one skip. The first CLI run's documentation failure is fixed; no failed run is relabeled.
**Gherkin:** ✅ Filtered acceptance lane passed 597/597 scenarios and 11140/11140 steps; proof-manifest lane passed 51/51. Filters exclude wip, proof.vitest, manual and live cases; this is not whole-parent acceptance or live qualification.
**Build:** ✅ All resolved workspace builds and Go build passed, including the website (nine pages). Existing website chunk-size, empty i18n and 404-route warnings are retained in the raw log.
**Lint:** ✅ Repository lint and targeted autofix checks passed; latest fixture edits also passed targeted lint.
**Typecheck:** ✅ All resolved TypeScript, Astro and Python checks passed. Astro reported zero errors/warnings/hints; mypy reported no issues in five source files.
**Scenarios:** ❌ Legacy ledger has 0/159 checked R/G/R checklist items. These are checklist items, not 159 executable scenarios. Historical broad acceptance failures/unfinished cases and 33 accepted deferrals remain unmodified.
**Refactor:** ✅ No production refactor warranted in this follow-up; test fixture and bundle-oracle structure were simplified where needed. Existing product behavior is unchanged.
**PR Scope:** ✅ Branch remains bounded to #5041's canonical shared clauses, invalidation validation, complete installed author-copy integrity, Product contract routing and their proof/evidence. Main's context identity, argument handling, approval repairs and stronger assertions are retained. No #5051 work or unrelated production fix added.
**Dep Drift:** ✅ No new architectural dependency introduced; configured architecture narrative covers the existing runtime/tooling choices. TypeScript's syntax parser was already an installed test dependency.
**Supply Chain:** ❌ Bun audit reported eight advisories (two high, three moderate, three low). Python audit scanners reported none; Go reported zero reachable vulnerabilities, with imported/required-package advisories outside called code. Dependencies and lockfile are unchanged by this PR; no broad dependency upgrade was attempted.
**Parent Epic:** 82T411, siblings 0/11 marked done. This child remains scenario-gate/in_progress; no parent advancement claimed.
**Reconcile:** ✅ No new production pattern deviation in the test-review follow-up.
**Experience:** ⚠️ Real-project copy checks succeed for all three phases. Walked the technical builder through copy-check refusal/recovery in the prior installed CLI walkthrough; worst step is locating/reconciling the trusted distribution, not granting a new approval. No extra authority step is introduced by these test edits. The parent's full repair/journey payoff is owned by other children and is not proven here.
**Surface Evidence:** ⚠️ Local CLI, installed Cursor/shared hooks and generated Claude/Codex assets have deterministic proof; native UI/private-injection and cloud enforcement remain deferred or advisory.
**Evidence limits:** ⚠️ Execution admits only Claude reviewers; its Claude asset-layout case uses a Codex author. Simulated reviewers are process-boundary fixtures, not live qualification. Three earlier semantic failures and historical admission-reuse limits remain unresolved.

Audit passed with warnings: zero factual errors, one explained dependency-cruiser
orphan warning for the retained historical admission evidence file. See
`audit.md` for exact scope, exclusions and answered review advisories.

## Surface evidence

| Affected surface | Command / boundary | Result |
| --- | --- | --- |
| Safeword CLI | Real-project `ticket planning-contract-check 5F5ZZA` for Product, Implementation and Execution, with host/plugin variables cleared | All three `current`, exit 0; copy usability only |
| Cursor / shared local hooks | Installed public approval and hook integration tests in the authoritative CLI suite | Final CLI suite passed; ordinary-terminal and installed-hook proofs included |
| Native Claude and Codex assets | `native-planning-copy-dispatch.test.ts` generated distributions, canonical/drift/missing/restore | 6/6 passed; explicit Execution author exception |
| Native bundle identity and generation | `codex-plugin-version.test.ts`, independent phase paths/raw hashes, common bytes, generation side effects | Combined native/bundle focus 25/25 passed |
| Canonical generation/refusal | `planning-contract-generation.test.ts`, exact changed-clause preconditions, real CLI refusal and unchanged installed bytes | 23/23 passed in first focus; one separate native setup failure retained |
| Native UI, private injection and cloud enforcement | skip: no new host qualification run; historical R7 deferral and advisory boundaries retained | Unverified/deferred |

## Independent review and preserved attempts

- Review `d33439d2-d2da-4998-ab67-c357c04a07ea`: Claude/opus,
  cross-agent, approved with no blocking errors. Its three fixture warnings led
  to the additional protection and environment edits.
- Final review `31f7b058-7408-49c4-b76c-b99f8e390b37`: Claude/opus,
  cross-agent, approved with no blocking errors. Status remained approved after
  the source/test commits. Remaining oracle-uniqueness, snapshot-concurrency and
  single-value-table advisories are answered in `audit.md`.
- Architecture repair review `88228738-0122-4cbc-97ff-6a886bdda1ee`:
  Claude/opus, cross-agent, approved with no blocking errors. Its stamp-history
  warning and preservation-evidence limit are answered by the 39-section review
  in `5041-architecture-prose-review.md` and archived original/comparison output.
- First focus: 47 passed / one failed. Matching the Claude Execution author
  exposed zero admitted independent routes. This is retained characterization,
  not a fabricated product RED. Admission was preserved via an explicit fixture
  exception. Corrected native run: 6/6. Final native/bundle focus: 25/25.
- Earlier failed full suites, degraded-review attempts, semantic failures and
  qualification deferrals remain in their original evidence records. No
  unchanged paid qualification was run.

Raw observations and SHA-256 manifest: `evidence/5041-verify-audit/`. All invoked
closing commands are terminal. The final stage table reports collector 0, CLI 0,
Go test 0 (no test files), remaining lanes 1 due to Bun audit. This does not erase
the failed root run.

The exact installed verify block was executed first. Its duplicate CLI entry
reproduced the documentation failure and was interrupted (exit 130) for repair.
After the root rerun stopped at relay, the unique remaining collector, CLI and
experiment tests were run directly, followed by the same resolver's BDD/build/
typecheck/dependency lanes. This avoids counting duplicate full-suite entries as
additional unique proof. The interrupted block and failed root rerun are retained.
The relay timeout/AbortError causes remain unestablished; no timeout or unrelated
production/test policy was altered.

## Remaining verification blockers

The relay failures are the installed Cursor persisted-request test (30-second
timeout) and saturated request-queue reconciliation (AbortError). Their unchanged
isolated pass is narrower evidence; no root cause or fix is claimed. The earlier
shared-deadline routing failure did not recur in the final CLI run, but its
original failed record remains preserved.

Bun audit's two high-severity reports name `http-cache-semantics` through the
website's Astro dependency and `braces` through tooling. Other reports name
DOMPurify (two), markdown-it, postcss-selector-parser, fast-uri and KaTeX. These
are scanner observations, not an adjudication of exploitability. Dependency
remediation would expand this bounded planning-contract change, so the findings
remain visible and blocking. No audit policy or dependency baseline was weakened.

The prior PR head `0f05da951` failed both Node CI lanes solely on the same
architecture placeholder. That document is repaired and the full local CLI
suite now passes; fresh pushed-head CI remains required. The three earlier
semantic failures, historical admission evidence limit, unfinished parent ledger
and accepted host-proof deferrals remain unresolved. Keep Draft; do not merge,
promote or mark the feature complete.
