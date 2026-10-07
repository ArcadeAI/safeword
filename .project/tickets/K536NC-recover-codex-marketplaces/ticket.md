---
id: K536NC
slug: recover-codex-marketplaces
type: task
phase: done
external_issue: https://github.com/ArcadeAI/safeword/issues/5430
status: done
created: 2026-10-07T03:51:49.009Z
last_modified: 2026-10-07T06:18:45Z
---

# Recover Codex installation for developers with local marketplaces

**Goal:** Honor valid local Safeword marketplaces and make broken registrations recoverable without modifying unrelated profile settings.

**Why:** Disposable development marketplace registrations block later installs.

## Scope

- Honor an explicitly configured local marketplace when Codex validates the same source.
- Give native recovery commands after failed global discovery.
- Preserve unknown registrations, unrelated settings, and newer Git pins.

## Out of scope

- Automatically replacing local sources or editing profile TOML.
- Isolating unrelated broken sources: Codex 0.153.4 exposes global discovery only; overrides merge persistent entries.

## Root Cause

A prior session explicitly registered a disposable worktree; normal install uses the official Git marketplace. Missing manifests fail global discovery before classification. Valid local registrations are rejected unconditionally during reinstall.

Ruled out: normal install registering cwd (CLI uses MARKETPLACE_SOURCE); invalid main manifest (native discovery validates it); project mutation (Changed: no).

## Design decision

Preserve explicit local sources when Codex discovery agrees with the profile. Automatic replacement overwrites user choices; isolation is unavailable. Official contract: https://developers.openai.com/plugins/build/plugins.

Premortem: another config layer could supply the same name; require agreement with the user-global CODEX_HOME/config.toml declaration. Accept only absolute local sources, and compare marketplaceSource.source exactly with the declared source rather than Codex's resolved root. Relative and tilde sources remain rejected because their layer-specific resolution is ambiguous.

## Inline tests

- Matching local source installs without marketplace or profile mutation.
- Undeclared or nonmatching sources remain rejected with repair instructions.
- Failed discovery retains its cause and offers native recovery without mutation.
- Existing newer-pin tests must continue rejecting installation with PLUGIN_NEWER_PIN_PRESERVED while leaving the Git pin unchanged; successful downgrades are forbidden.
- A mismatched user-global local declaration and another layer's undeclared source remain rejected.
- Recovery includes Codex's failing registration verbatim. Advice offers marketplace add with a persistent source or removal as an explicit user choice. Safeword executes neither automatically.

## Work Log

- 2026-10-07T03:51:49.009Z Started: Created ticket K536NC
- Local-live-host proof: Codex 0.153.4 registered the persistent main checkout into an isolated temporary CODEX_HOME using its native marketplace add command. The resulting TOML contained source_type = "local" and an absolute source; marketplace list reported that exact source. Before this change, source-CLI codex install failed with PLUGIN_MARKETPLACE_FAILED / not a Git marketplace. After this change it installed/enabled version 1.0.0, returned no errors, and correctly reported app restart required. No real-profile settings were changed.
- Missing-own and broken-unrelated marketplace probes in the isolated profile retained the full native error and returned changed=false with repair guidance. Native marketplace add repaired the missing-own registration. The unrelated probe was removed only from the isolated profile.
- Intake independently approved by Claude Opus (70b93cfb); early code review fb381e02 found no blocking errors, followed by complete-diff approval 61905c05. Native proof above validates Codex 0.153.4's declared absolute source and profile format; other normalization cases remain a host-contract coverage gap. The stricter absolute-path and source-type boundaries have regression coverage. Subprocess environment override consistency is inherited debt; production CLI execution uses one environment throughout.
- Verification retry: targeted migration tests passed 96/96. Complete CLI rerun passed 10,473 tests with 14 skipped; acceptance passed 596 scenarios and 11,118 steps. Build/typecheck passed. The first full run had one intermittent review-deadline failure; baseline dependency audit findings and remaining standalone proof/smoke checks are recorded in verify.md. Only this session's blocked closing command was stopped when another chat began a new 63-case live run. Ticket remains in verify; completion is not claimed.
- Final verification: after the other chat released its lock, standalone BDD proof passed 47/47 and fast smoke passed 2,143/2,143. All CI checks passed for the source commit. Draft PR https://github.com/ArcadeAI/safeword/pull/5572 links #5430 and records the remaining readiness state; no Ready promotion or merge is authorized.
- Completion authorized by the user's subsequent "get green and admin merge" request. Verification exit independently approved by Claude Opus (04475ecb); its phase stamp succeeded. Fresh isolated native installation and matching tilde-source rejection checks passed. Implementation remains unchanged.

## Follow-up debt

- Reconcile the public custom-environment argument with the environment inherited by native Codex subprocesses before supporting callers that supply a different CODEX_HOME from process.env. This inherited programmatic-call inconsistency is outside this fix; the production CLI uses one environment throughout.
