---
id: FA3KG9
slug: keep-native-plugins-current
type: feature
phase: verify
phase_skips:
  - "intake: Backfilled after the maintainer-led issue 1785 investigation and accepted scope discussion already occurred in this task."
  - "define-behavior: Backfilled after the maintainer accepted the dual-host stable-channel and non-blocking Codex behavior in this task."
  - "scenario-gate: Backfilled after independent scenario review completed in this task before the implementation plan was finalized."
  - "plan-implementation: Backfilled after independent plan review completed in this task before production implementation continued."
status: in_progress
scope:
  - move supported Claude Code and Codex installations onto one release-managed stable channel
  - enable each host's native startup update path and preserve its native reload semantics
  - migrate trusted Safeword marketplace declarations from exact tags or the default branch
  - replace the proven pre-plugin handoff with an enrollment bootstrap that warns prominently until native execution is verified
  - on the first eligible upgrade, install the native Codex plugin, retain one minimal enrollment bootstrap, and transactionally remove the recognized legacy Codex allowlist
  - auto-enroll each later developer's local Codex profile and warn until a later task proves native activation
  - check readiness at Codex task start and show one prominent plain-language recovery message without blocking work
  - serialize concurrent Codex profile mutations and make stable promotion monotonic under concurrent releases
  - advance the stable channel only after a verified stable npm publish succeeds
  - keep prerelease and live acceptance paths pinned to an exact immutable tag
out_of_scope:
  - releasing, tagging, publishing, or moving the live stable channel in this task
  - silently replacing third-party or malformed marketplace declarations
  - promising mid-prompt activation when a host only reloads plugins at a session boundary
  - adding a second Safeword package-level updater for native plugins
  - requiring a dedicated migration command or human confirmation for an eligible pre-plugin handoff
  - claiming that already-released observation-only Codex hooks can self-modify before a current Safeword maintenance run reaches them
  - retaining the legacy Codex compatibility suite after the enrollment bootstrap is installed
  - committing one developer's profile enrollment or proof as repository state
done_when:
  - new and existing trusted Claude installations converge on stable with auto-update enabled
  - new and existing trusted Codex installations converge on stable and use Codex startup refresh
  - prerelease tests can still select an exact tag without entering the stable channel
  - release automation promotes stable only after a successful non-prerelease publish
  - failures preserve or clearly recover the last known-good installation
  - the first eligible upgrade leaves only the minimal bootstrap plus user-authored Codex configuration, with every recognized legacy asset backed up and removed
  - each later developer auto-enrolls without repository churn and receives a prominent warning until a new task proves native activation
  - an unready Codex task reports the problem at startup with one understandable next action but does not prevent work
  - concurrent project, Codex-profile, and release-channel operations converge without partial state or stable-version rollback
phase_anchors:
  - define-behavior: .project/tickets/FA3KG9-keep-native-plugins-current/spec.md
  - scenario-gate: packages/cli/features/keep-native-plugins-current.feature
  - plan-implementation: .project/tickets/FA3KG9-keep-native-plugins-current/impl-plan.md
  - implement: .project/tickets/FA3KG9-keep-native-plugins-current/impl-plan.md
  - verify: .project/tickets/FA3KG9-keep-native-plugins-current/test-definitions.md
  - done: .project/tickets/FA3KG9-keep-native-plugins-current/verify.md
created: 2026-08-04T12:41:13.239Z
last_modified: 2026-08-05T06:30:19Z
---

# Keep native plugins current for builders

**Goal:** Automatically advance installed Safeword plugins to verified stable releases in Claude Code and Codex.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-05T06:30:19Z Phase: implement → verify. The full verification and audit evidence is recorded in `verify.md`; the subsequent release pass also fixed stable-version rejection of historical prerelease/build marketplace tags.
- 2026-08-04T12:41:13.239Z Started: Created ticket FA3KG9
- 2026-08-04T12:45:00.000Z Intake research: Claude supports per-marketplace auto-update and intentionally requires `/reload-plugins` or a later launch for an already-running session. Codex 0.146.0 and current upstream source auto-upgrade configured Git marketplaces at startup and refresh installed caches. Chose a release-promoted `stable` ref over package-hook updates or tracking `main`; RC paths remain exact-tagged.
- 2026-08-04T12:45:00.000Z Isolated host probe: Codex treats the same repository with a new ref as a different source and requires remove/re-add; marketplace removal removes the installed cache but preserves the enabled plugin declaration, allowing re-add plus install to restore it.
- 2026-08-04T12:50:00.000Z Intake amendment: Added the maintainer job explicitly—supported installations should converge on fixed stable versions so version drift does not become recurring support work.
- 2026-08-04T12:55:00.000Z JTBD quality review: Independent cross-agent review approved the intake packet and flagged no critical issues. Tightened the jobs to avoid promising update-at-start timing, name Claude's reload signal, and limit the maintainer convergence guarantee to supported local Claude Code and Codex installations.
- 2026-08-04T12:59:14.000Z JTBD gate accepted by the user. Defined twelve Rules across builder convergence and opt-out, plain reload and recovery behavior, and maintainer-controlled publication, trust, and cross-host consistency.
- 2026-08-04T13:01:00.000Z Rules gate accepted by the user. The agreed invariants preserve host opt-outs, isolate prereleases, retain last-known-good protection on update failure, make legacy migration recoverable, and keep stable promotion behind verified publication.
- 2026-08-04T13:05:00.000Z Intake amendment: Distinguished marketplace channel migration from the existing pre-plugin handoff. The feature preserves explicit enrollment, legacy authority until project-bound native proof, selective backed-up cleanup/finalization, and recovery; generic setup or upgrade will not silently mutate profiles or retire protection.
- 2026-08-04T13:07:00.000Z Superseded clarification: Initially recorded the handoff as human-authorized; the user immediately corrected that it must not require a human.
- 2026-08-04T13:09:00.000Z Authority amendment: Eligible pre-plugin projects automatically enroll during ordinary current-CLI maintenance, retain legacy authority until project-bound plugin proof, and automatically retire only verified Safeword-owned legacy assets on later maintenance with backup and recovery. Previously released Codex-only observation hooks cannot initiate new behavior before a current CLI run reaches the project.
- 2026-08-04T13:15:00.000Z Concurrency amendment: A developer's local proof cannot safely delete shared repository fallback hooks for collaborators with separate profiles. Chose a rolling per-profile authority handoff: proven profiles yield the fallback to the native plugin, unenrolled profiles keep fallback protection, Codex profile mutations serialize under an atomic owner-bound lock, project maintenance retains the Git-common-dir lock, and stable promotion is globally serialized and monotonic.
- 2026-08-04T13:20:00.000Z Superseded rolling-fallback design at the user's direction: the first upgrade must remove the legacy junk. Replaced it with one minimal committed enrollment bootstrap. The first upgrader installs native Codex and transactionally backs up/removes the finite legacy allowlist; each later profile auto-installs from the bootstrap, and mutation fails closed until a subsequent task proves the native plugin loaded.
- 2026-08-04T13:24:00.000Z Readiness amendment: Every Codex task performs a visible startup readiness check. Until proof binds the exact profile, canonical project, plugin identity, and current task, edits and potentially mutating shell actions hard-block before state changes. The loud NTB-facing message states what is missing, confirms files were untouched, and gives exactly one new-task or retry action.
- 2026-08-04T13:31:00.000Z Readiness amendment: Superseded the fail-closed mutation gate at the user's direction. An unready task now emits one prominent startup warning that explains protection is absent and gives one recovery action, while edits and shell commands remain available.
- 2026-08-04T13:35:00.000Z Intake scope accepted by the user's instruction to proceed. Authored the stable-update, automatic migration, enrollment, warning, recovery, trust, and concurrency scenarios and advanced them to review.
- 2026-08-04T13:43:00.000Z Scenario gate: Independent Claude review approved all 23 Rules with complete positive and rejection coverage. Applied its refinements to observable channel resolution, exact-tag terminology, and per-Rule implementation tracking; no build-only kill-risk remains after the prior isolated host probes.
- 2026-08-04T13:55:00.000Z Implementation plan: Independent Claude review approved the five-slice design after an extended coordinator timeout. Clarified project/session-bound proof ordering, the declaration-versus-live-host proof lanes, and that the workflow change cannot move or create the live stable ref in this task.
