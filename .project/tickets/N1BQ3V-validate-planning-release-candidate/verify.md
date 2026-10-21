# Release candidate verification

Candidate: `2.0.0-rc.1`, based on main `a3c216940fc12a912f97a3f77820e280e1203b65`.
This delivery changes release versions and generated identities, not planning behavior.

## Verify Checklist

**Test Suite:** ✓ Full local regression: 11,977 passed, 14 skipped across 731 files. Release assertions: 83/83; targeted activation/migration: 109/109 (overlaps the full suite, not an additional unique count).
**Gherkin:** ✅ 601/601 package acceptance scenarios and 11,821/11,821 steps pass. Targeted repair checks: 11/11 scenarios, 210/210 steps.
**Build:** ✅ Success — CLI and generated plugin artifacts built.
**Lint:** ✅ Initial CI passed; changed fixture files passed repository ESLint and formatting checks after the final edit.
**Typecheck:** ✅ Clean — root package checks rerun after the final fixture edit.
**Scenarios:** Existing scenarios retained; no new product behavior or scenario expectations.
**Refactor:** ✅ No change warranted — release metadata and narrowly corrected fake-host records.
**PR Scope:** ✅ Diff matches release preparation and its verification fixtures.
**Dep Drift:** ✅ Clean — frozen install; lockfile changes only the workspace version.
**Parent Epic:** #4200 remains open; this patch prepares a candidate, not epic completion.
**Reconcile:** ✅ No pattern deviation — canonical version sources and generators retained.
**Experience:** ⏭️ N/A — metadata patch; real upgrade walkthrough recorded below.
**Surface Evidence:** ✅ CLI upgrade, Claude discovery and Codex cache/hook proofs observed; Desktop restart and deferred hosts remain unverified.
**Evidence limits:** ⚠️ Local regression has 14 conditional skips; initial CI ran five additional checks and retained nine skips. These are not counted as passes. Final-head CI remains pending; 33 deferred cases remain unverified; no fresh semantic qualification or Desktop restart.

## Observed checks

- All five generated surfaces regenerated and checked current. Claude release identity, historical catalogue and inventory checks passed. Parity: 277 pairs and 11 contracts in sync.
- Root typecheck passed. Frozen dependency install passed. Bun retained the old workspace version during both normal install and lockfile-only refresh; only that workspace version was corrected, with no dependency-resolution changes.
- First release run: 82 passed, one failed because `.safeword/version` still said `1.2.0`. Reconciled through `safeword install --agents=none`; repeat release run passed 83/83 assertions in 14 files.
- Created the candidate tarball with `npm pack --ignore-scripts` from the built CLI. SHA256: `1ccef04ad9c83ce00c54cbe2e759a0b71ba1986dd1d5c938e70eb296fc425ab2`. The separate local Bun pack consumed a CPU for over three minutes without output and was stopped; this is not recorded as a successful Bun pack or a successful publish-workflow run.
- A bounded Bun retry using `bun pm pack --ignore-scripts --gzip-level 1 --filename /tmp/safeword-rc-bun-validation.tgz` passed. All 928 archive files have identical bytes to the npm archive. This does not establish which option resolved the earlier delay; no release-workflow change was made.
- A final Bun pack passed after regression testing. Its 559 non-dist files, including the complete Codex plugin, match the exercised candidate byte for byte. CLI dist chunks have updated Git build provenance (embedded by tsup.config.ts) and different names; the final packaged CLI was installed into the isolated tooling and reconciliation again returned healthy with no changes.
- Installed published `safeword@1.1.0` into isolated tooling, initialized a disposable project, then installed the candidate tarball and reconciled using `install --agents=none --no-input`. Version advanced to `2.0.0-rc.1`; custom AGENTS instructions and an authored ticket were preserved. Repeating installation returned `healthy`, `changed:false`, and no effects.
- Real Claude CLI installed the candidate from the local marketplace into a disposable profile. Discovery reported 24 skills, two agents and seven hook events. No model session was started for this check.
- Real standalone Codex CLI installed the packed plugin into a disposable profile, reporting version `2.0.0-rc.1`. All 299 packed plugin files matched the installed cache byte for byte. This proves package discovery and copying, not hook execution or Desktop activation.
- Deterministic activation and targeted migration tests passed 109/109 in seven files.
- The shared production `runHeadlessCodexActivationCheck` also passed against the actual packed cache using standalone Codex 0.163.0 and `gpt-6.1-sol`. All five hook files matched the candidate version and activation ID. Headless activation stayed pending, as required; temporary authentication was removed. This was direct production-helper execution, not the complete opt-in Vitest smoke suite.
- Independent Claude Opus review `03ed4acc-e6e0-4a7a-8688-7d81696fb7af`: approved, cross-agent independence, no blocking findings. This review covered canonical versions, Claude identity and release notes, with the release workflow and generation checker as context. The later lockfile version correction is a matching metadata change, not reviewed behavior.

## Review responses and limits

The reviewer requested passing generated-identity evidence; the checks above supply it. Version synchronization is additionally enforced by `scripts/check-version-sync.ts` and the release test suite, not only the workflow's tag comparison. The main-branch marketplace exposure is a disclosed consequence requiring the release PR's explicit merge approval. The unchanged channels are npm latest and the stable plugin branch, not all repository installation routes. PR #6031 is not merged into this candidate and its failing qualification results are not passing candidate evidence.

Intake review `8d7d0abf-46fe-4534-b1d0-3ccaa8a20c85` was also independently approved by Claude Opus and recorded through the normal receipt verifier. All three canonical version sources, generated Codex package, Claude package/identity and repository version marker agree at `2.0.0-rc.1`. Annotated tagging is the release procedure, not an enforcement claim about all possible Git pushes. The workflow serializes stable and prerelease publishing. The local-retro readiness manifest is disabled, so its production cutover job is intentionally not required. Observed baseline: npm `latest=1.1.0`, `next=1.0.0-rc.5`; stable branch `d5885e58771cd87f8108196ce67986f7725a1974`; remote main matched the source commit above.

Initial CI run 39685557820 passed both unit matrices: the Node 24 CLI suite reported 11,630 passed and nine skipped, plus relay 199 passed and collector 153 passed. Its package acceptance lane failed six scenarios (595/601 passed). The fake Codex hosts did not persist the marketplace reference; prereleases correctly require an exact tag, so subsequent fake-host operations attempted an unimplemented marketplace replacement. Repair only fixture profile metadata during initialization/add; preserve production behavior and every assertion. Fake adds now persist the source and tag actually requested. Final targeted rerun: 11 scenarios and 210 steps passed; final full package acceptance rerun: 601 scenarios and 11,821 steps passed. Local full regression: CLI 11,626 passed/13 skipped, relay 198 passed/one skipped, collector 153 passed. The local relay container qualification requires CI on Node 24 with Docker; optional install/language checks retain their existing opt-in conditions. Updated-head CI is still required before publication.

No fresh paid semantic qualification or real Desktop restart is claimed. No OpenCode or cloud qualification was run; the existing CI OpenCode conformance job passed and does not close those deferred cases. The 33 deferred cases remain deferred and unverified. The originally reported six failures and 585 unfinished scenarios are historical incomplete evidence, not converted to passes by this candidate. Historical acceptance and #4200 recovery evidence remain visible; this candidate does not close the epic. PR #6031 and #5857 remain excluded.

## Publication boundary

Not published. No release PR merge, tag push, Ready promotion or stable promotion has occurred. Before publication: finish the pending local checks, obtain terminal current-head CI, and obtain explicit approval to merge the concrete release PR. Then annotate the merged commit as `v2.0.0-rc.1`, push that tag, watch Release, and confirm npm `next` becomes the candidate while `latest` remains `1.1.0` and the stable plugin branch stays unchanged. A failed check pauses publication; do not weaken it or claim a pass. Recovery means stop using the candidate and retain the prior stable channel; preserve project-authored content and review history rather than promising automatic downgrade of newer state.
