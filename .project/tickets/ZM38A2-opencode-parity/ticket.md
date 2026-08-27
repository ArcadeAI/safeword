---
id: ZM38A2
slug: opencode-parity
type: feature
phase: done
status: done
phase_anchors:
  - "implement: .project/tickets/ZM38A2-opencode-parity/impl-plan.md"
  - "verify: .project/tickets/ZM38A2-opencode-parity/test-definitions.md"
  - "done: .project/tickets/ZM38A2-opencode-parity/verify.md"
scope:
  - add OpenCode as an explicit agent selection while preserving the Claude-plus-Codex omitted default and existing managed legacy evidence
  - standardize Claude Code, OpenAI Codex, OpenCode, and Cursor behind one integration-adapter contract
  - reconcile OpenCode commands and agents while reusing OpenCode's documented `.claude/skills` compatibility loader without duplicating workflow bodies
  - install and remove a versioned Safeword profile plugin through OpenCode's global plugin directory without editing opencode.json
  - deny covered OpenCode tool calls through stable tool.execute.before and record bounded activation/event evidence
  - report installation, activation, lifecycle capability, and conformance as independent status dimensions with one human next action
  - prove the pinned OpenCode 1.18.23 baseline through a credential-free real-process catalogue and denial fixture
out_of_scope:
  - adding OpenCode to the default agent selection or probing an unselected OpenCode executable
  - OpenCode V2 beta support or a promise that every OpenCode 1.x release is compatible without conformance
  - committed executable project plugins or edits to user-owned opencode.json
  - exact-call IPC receipts, sockets or named pipes, liveness sweepers, executable digests, or plugin-exclusivity claims
  - blockable stop continuation where OpenCode exposes only observational lifecycle events
  - protection against arbitrary same-user tampering or bypass outside the coding agent's native hook boundary
done_when:
  - explicit OpenCode selection installs its profile plugin and native catalogue while the default and unselected paths remain byte-for-byte compatible
  - a real OpenCode 1.18.23 process discovers a Safeword command, agent, and canonical skill and a forbidden sentinel tool call produces no side effect
  - status deterministically distinguishes healthy, action-required, and advisory OpenCode states without promoting stale or observational evidence
  - install, upgrade, mixed-host reconciliation, and uninstall preserve user-owned OpenCode content and every still-consumed shared asset
  - adapter contract tests cover all four local agent integrations and the full repository verification suite passes
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-25T19:47:58.929Z
last_modified: 2026-08-27T05:42:33.000Z
---

# Give OpenCode builders full Safeword protection

**Goal:** Make Safeword workflows and automatic guardrails work through OpenCode with truthful cross-host parity.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-25T19:47:58.929Z Started: Created ticket ZM38A2
- 2026-08-25T19:49:33.000Z Intake: Confirmed OpenCode as a durable product surface and drafted the customer jobs for review.
- 2026-08-25T19:53:36.000Z Quality review: Clarified shared skill ownership, added the maintainer standardization job, and made protection evidence observable; retained OpenCode's verified plural project paths.
- 2026-08-25T19:56:14.000Z Quality review: Made all standardized local-host surfaces affected, disambiguated overlapping surface tags, and defined receipt validity and truthful stop-boundary status.
- 2026-08-25T19:59:51.000Z Quality review: Defined aggregate shared-tree deletion, capability-first status precedence, upgrade recovery, and the explicit unaffected-surface partition; anchored disputed OpenCode paths to current official docs.
- 2026-08-25T20:04:36.000Z Quality review: Verified plural OpenCode paths against immutable v1.18.23 sources, limited deletion to Safeword-managed entries, defined receipt trust and sessionless status, and chose default installation for parity.
- 2026-08-25T20:09:00.000Z Quality review: Recorded the canonical repository redirect and immutable commit, verified stable shell-session binding types, and completed migration, receipt lifecycle, and cross-host proof expectations.
- 2026-08-25T20:12:57.000Z Quality review: Replaced long-lived activation evidence with consumable exact-tool-call enforcement proof and tightened upgrade/runtime verification requirements.
- 2026-08-25T20:16:18.000Z Quality review: Required independent denial capability plus current delivery for enforced status, added native catalogue discovery proof, and made receipt freshness and repeat status deterministic.
- 2026-08-25T20:21:06.000Z Quality review: Verified stable hook order and call IDs from pinned source, bound receipts to call liveness, and removed overstated filesystem-tamper protection.
- 2026-08-25T20:25:02.000Z Quality review: Defined automatic local capability attestation for compatible OpenCode updates and bound call liveness to the observed host process rather than a fixed timeout.
- 2026-08-25T20:28:29.000Z Quality review: Added fail-closed orphan-receipt expiry and error revocation, host process incarnation binding, platform privacy rules, and full local conformance coverage.
- 2026-08-25T20:33:15.000Z Quality review: Replaced forgeable filesystem delivery receipts with live plugin IPC proof and verified documented plural paths against the pinned runtime loaders.
- 2026-08-25T20:37:34.000Z Quality review: Made the standalone-status TTL unconditional, replaced metadata digest caching with full host-activation hashing, and specified thin native catalogue stubs and user-config proof.
- 2026-08-25T20:49:12.000Z Quality review: Anchored credential-free tool-call conformance to OpenCode's pinned loopback test harness and made explicit-config plus auto-discovery precedence deterministic and falsifiable.
- 2026-08-25T21:02:48.000Z Quality review: Protected legacy upgrades from silently selecting OpenCode, added disabled/uninstalled/crashed-plugin fail-closed proofs, and bounded and redacted cross-platform attestation evidence.
- 2026-08-25T21:13:26.000Z Quality review: Distinguished advisory uncovered boundaries from repairable failures, scoped IPC per host incarnation for concurrent sessions, removed nondeterministic hashing timeouts, and gated `enforced` on atomic proof delivery.
- 2026-08-25T21:24:41.000Z Quality review: Made OpenCode default selection presence-aware, allowed newer stable 1.x builds to earn local conformance, narrowed transcript privacy to Safeword-owned output, and removed live-call TTL false negatives.
- 2026-08-25T21:37:08.000Z Quality review: Bound enforced proof to an armed project policy, added the full auto-selection and opt-out matrix, simplified IPC to live-plugin freshness, and covered aborted calls and plugin conflicts.
- 2026-08-25T21:49:32.000Z Quality review: Preserved legacy host selections by deriving them from managed evidence, removed automatic OpenCode enrollment, and required explicit trusted executable selection before any probe or plugin install.
- 2026-08-25T22:02:11.000Z Quality review: Closed executable escape hatches, removed version-based proof ambiguity, made edit-path bypasses explicit, and bounded digest, loopback, call-map, and Windows stale-state behavior.
- 2026-08-25T22:07:43.000Z Quality review: Applied the trusted-path predicate to every launcher, interpreter, symlink, import target, and final executable before OpenCode selection can execute anything.
- 2026-08-25T22:16:19.000Z Quality review: Separated install-time launch-chain provenance from the final executable digest the live plugin can actually observe and match to passing conformance.
- 2026-08-25T22:25:54.000Z Quality review: Replaced challenge-driven orphan cleanup with an independent authoritative OpenCode call-state sweep and a fail-closed saturation recovery.
- 2026-08-25T22:38:20.000Z Quality review: Separated all-tool interception from shell-only receipt proof, removed project policy from machine attestation, defined live policy arming, and pinned the liveness SDK and MIT license sources.
- 2026-08-25T22:50:07.000Z Quality review: Made evidence classes exhaustive and moved bundle/policy integrity checks into the independent Safeword status process so the project plugin cannot self-attest.
- 2026-08-25T23:02:36.000Z Quality review: Scoped enforced to untampered same-user state, secured persistent evidence storage, and moved bounded liveness maintenance fully off the denial path.
- 2026-08-25T23:15:18.000Z Quality review: Added self-protection invariants, made enforced exclusive to the sole project plugin, and separated intercepted-but-unproven boundaries from observe-only advisory ones.
- 2026-08-25T23:46:44.000Z Quality review: Restated shell self-protection and launch-chain races within the same-user boundary, made plugin exclusivity cover every loader origin, classified invalidated attestations, and pinned the user-visible enforcement caveat.
- 2026-08-26T03:39:07.000Z Intake: Confirmed the three customer jobs and capability-first boundary; moved executable OpenCode enforcement to an intentional profile install, deferred exact-call IPC receipts, and drafted the persona-level Rules.
- 2026-08-26T03:50:00.000Z Intake: Clarified host as agent integration in user-facing language, confirmed the Rules, and drafted the capability-first engineering scope.
- 2026-08-26T04:05:00.000Z Intake cold-start check: Insufficient; a fresh read found ten unresolved contracts covering canonical skill ownership, adapter shape, selection migration, catalogue/enforcement inventory, profile ownership, evidence/status schemas, version policy, and shared reconciliation.
- 2026-08-26T04:36:00.000Z Intake: Closed all ten cold-start gaps. Kept Safeword-owned `.agents/skills` retired, reused OpenCode's `.claude/skills` compatibility loader, specified the adapter/lifecycle contract, profile ownership, evidence schemas, deterministic status precedence, exact 1.18.23 support boundary, and aggregate reconciliation.
- 2026-08-26T04:49:00.000Z Define behavior: Derived twelve behavioral dimensions and saved twenty scenarios across all nine Rules, including rejection paths and coverage for every affected surface. Advanced to scenario-gate.
- 2026-08-26T05:04:00.000Z Scenario gate: Cross-agent Opus review requested changes. Added permitted and uncovered tool paths, simultaneous-condition action precedence, atomic install/uninstall and consumer-removal outlines, profile drift/user-modification coverage, retired `.agents/skills` proof, exact registry order, and advisory-without-action assertions.
- 2026-08-26T05:18:00.000Z Scenario gate: Second cross-agent review exposed three remaining proof gaps. Added surface wiring, injected-sentinel coordinator proof, config-root precedence and opencode.json preservation, bash mapping, exact activation boundary, bounded evidence privacy, unselected uninstall no-probe behavior, and split real-process catalogue/denial checks.
- 2026-08-26T05:31:00.000Z Scenario gate: Third cross-agent review tightened the frozen contract. Added runtime-kind and hashed call binding to activation evidence, malformed-input denial, non-vacuous catalogue and uninstall assertions, explicit platform roots, positive managed-asset sweep, read-only health, crash-safe profile replacement, and plugin-hash conformance invalidation.
- 2026-08-26T05:43:00.000Z Scenario gate: Fourth cross-agent review closed the remaining must-fix boundaries. Added mixed-empty config precedence, absent/unknown activation handling, denial-fixture positive control, activation privacy, absent opencode.json preservation, TUI coverage, concurrent-install convergence, and explicit upgrade preservation.
- 2026-08-26T05:55:00.000Z Scenario gate: Fifth cross-agent review removed an ambiguous OpenCode-owned skill claim, added explicit OpenCode-only shared-skill delivery, pinned dispatcher failure classes and hashed identifiers, covered CLI selection rejection, and added existing-integration regression and adapter-overstatement proofs.
- 2026-08-26T06:12:00.000Z Scenario gate accepted by Alex. Advanced to plan-implementation with the real OpenCode 1.18.23 denial fixture as the load-bearing first slice and a seven-slice registry/profile/catalogue/status build order.
- 2026-08-26T06:26:00.000Z Plan review returned to scenario-gate after finding a global fail-closed orphan risk. Added the invariant that the profile plugin is inert outside marked Safeword projects, explicit profile uninstall ownership, and corrected the first slice to a disposable host-contract proof that is later repointed at production.
- 2026-08-26T05:52:00.000Z Revised scenario gate approved by an independent cross-agent Opus review. The 78-scenario contract now covers inert profile behavior outside marked projects, declarative-only project delivery, shell-free dispatcher transport, complete patch target extraction, bounded evidence cleanup and freshness, shared config-root resolution, host-neutral conformance and plan effects, and origin-main compatibility fixtures. Awaiting fresh user confirmation because these safety behaviors changed after the prior approval.
- 2026-08-26T06:00:00.000Z Scenario gate reconfirmed by Alex and stamped with cross-agent review provenance. Advanced to plan-implementation to reconcile the seven-slice design with the final approved contract.
- 2026-08-26T08:00:00.000Z Plan review returned to scenario-gate after finding two unresolved global-plugin recovery boundaries: marker resolution can fail before project classification, and a profile plugin can outlive its pinned dispatcher. Added explicit self-disable/stale-proof behavior for unresolved markers and deny-closed repair guidance plus status priority for a confirmed marked project with an unavailable dispatcher.
- 2026-08-26T08:46:18.000Z Revised scenario gate approved and stamped after cross-agent Opus review. The 99-scenario contract now proves marker-resolution self-disable and recovery, deny-closed missing-dispatcher repair, non-persisted OpenCode selection, deterministic cross-platform profile roots, atomic and collision-safe profile ownership, canonical tool envelopes, exact evidence paths and privacy, version-bound conformance, cross-project uninstall scope, truthful single-action health, and origin-main adapter compatibility. Awaiting fresh user confirmation because these behaviors materially extend the previously accepted gate; approved-review hardening notes will be carried into plan review.
- 2026-08-26T15:44:55.000Z Scenario gate reconfirmed by Alex with an explicit direction to stay focused, elegant, and avoid overhardening. Advanced to plan-implementation; the reviewed design will retain the seven behavior slices while minimizing new abstractions and dependencies.
- 2026-08-26T16:10:11.000Z Scenario gate refreshed after restoring the spec's no-project-mutation atomicity clause and rebasing onto v0.79.4 origin/main. Independent cross-agent Opus review approved all 99 scenario/ledger pairs; its bounded warnings were assigned to existing slices without adding abstractions or scenarios.
- 2026-08-26T16:16:01.000Z Plan review corrected prerequisite order: plugin-dependent proof moved to the plugin slice, catalogue-dependent proof to catalogue delivery, the required-CI scenario to CI promotion, and full-adapter proofs to production registration. Bound conformance to the existing typed CLI protocol and removed an unapproved Windows fallback claim.
- 2026-08-26T16:22:24.000Z Plan review fixed the offline dispatcher boundary: identity binds an absolute package dispatcher path and hash, and hooks invoke it directly with Bun rather than package-manager resolution. Moved canonical-plugin scenarios to plugin generation, split the overloaded final wiring step into 6a/6b checkpoints, and moved CI-tagged interruption proof to CI promotion.
- 2026-08-26T16:28:56.000Z Plan review made the runtime binding decisive: slice 1 must prove the loaded OpenCode binary can spawn a fixture through the exact absolute Bun interpreter binding later stored in identity. Registered OpenCode lifecycle selection before CLI-shaped profile scenarios, moved status-dependent proofs behind the projector, and scoped catalogue collision rollback to the OpenCode adapter only.
- 2026-08-26T16:35:23.000Z Plan review generalized runtime binding to the installer's actual `process.execPath`, with a Node/Bun-compatible dispatcher and one unavailable-binding repair state. Slice 1 now proves awaited spawn-then-deny and all five covered tool shapes; CI owns all GitHub-sandbox real-process scenarios, and Windows filesystem support is explicitly outside the initial Ubuntu boundary.
- 2026-08-26T16:42:21.000Z Independent plan review approved. Before stamping, moved real-byte lock convergence and the remaining CI-tagged privacy proof behind their actual boundaries, defined post-profile catalogue failure without rolling back other projects' guard, targeted runtime loss through the approved unavailable-binding scenario, and aligned glossary/performance documentation.
- 2026-08-26T16:51:25.000Z Final plan verification found and resolved the activation-version source: pinned OpenCode 1.18.23 exposes `client.global.health()`, read once at plugin initialization and omitted on failure. Removed stale lock wording, restored per-file catalogue reconciliation, and bound allow-path proof to the real host fixture.
- 2026-08-26T17:00:28.000Z Final adversarial pass moved optional version lookup behind confirmed enrollment with a 100 ms fail-open deadline, added a 50 ms uncached marker deadline, bound conformance to byte-identical installed plugin bytes, split health from shared reconciliation, and made late catalogue I/O plus performance limits explicit.
- 2026-08-26T17:06:24.000Z Plan implementation approved and stamped by an independent cross-agent Opus review. Advanced to implement with the disposable real OpenCode 1.18.23 host-contract proof as the first stop/go boundary.
- 2026-08-27T05:38:19.000Z Evidence waiver: Alex explicitly authorized closing with a documented waiver after being told that 63 of 99 scenarios lacked reconstructable per-step commit history. No historical SHAs were invented; the waiver covers only the missing ledger history, not behavioral verification.
- 2026-08-27T05:38:19.000Z Verify: Exact-head GitHub CI passed at a0363d051, including OpenCode conformance, full acceptance, CLI contract, parity, lint, typecheck, architecture, dependency audit, and both supported Node lanes. Local full-suite, BDD, build, typecheck, documentation, and audit evidence is recorded in verify.md.
- 2026-08-27T05:42:33.000Z Complete: Closed the ticket after the verification artifact and evidence-integrity waiver passed the repository's ledger, phase-anchor, verify-shape, and phase-legality gates.
