# Impl Plan: Point-of-need Safeword project contexts

**Status:** planned
**Planned on:** 2026-09-13

## Approach

The riskiest assumption is that one logical context can redirect existing ticket, knowledge, proof, and mutable-state consumers outside the repository without becoming a leaky per-file union. The cheapest decisive proof is **Declining local setup continues automatic BDD in global storage**: drive the packaged Codex BDD artifact to its first ticket write, decline, and require all five BDD artifacts in the hashed global namespace with zero repository mutation.

Build four components described in `design.md`: Git-aware private storage, a root-level context resolver and route catalogue, a host-neutral enrollment/resume coordinator with native consent adapters, and plan-driven hydration. Reuse the lifecycle planner, reconciliation effects, durable-write helper, configured namespace resolver, integration registry, and generated-artifact pipeline. Do not create a second installer or a filesystem union.

### Proof plan

| Scenario group | Primary proof | Supporting and wiring proof |
| --- | --- | --- |
| R1 — resolution, point-of-need timing, lifecycle exemptions, precedence, catalogue parity | Integration tests run the real context resolver from each installed/generated artifact while an external observer records repository and user-data filesystem access | Unit partition tables for current marker, ancestor markers, exact global state, non-marker lookalikes, lifecycle commands, guarded/unguarded/uncatalogued routes; real CLI subprocess |
| R2 — builder consent and bounded repository effects | Integration through the real lifecycle preview/apply boundary with independent before/after and access observation | Native-adapter input provenance tables; installed Claude, Codex, OpenCode, and Cursor artifacts reject agent-authored acceptance; planner-effect membership tests |
| R3 — global fallback, privacy, identity, reuse, worktrees | Integration writes named BDD/review records through real logical paths into isolated temporary user-data roots | Real Git worktree fixture for common/worktree keys; non-Git canonical-path fixture; POSIX mode proof; unavailable-store rejection; byte-level cross-partition isolation |
| R4 — exactly-once resume and concurrent drift | Integration coordinator tests with the real resolver and lifecycle result envelopes | Consume-once state-machine units; sufficient/insufficient concurrent install; partial, cancelled, failed handoff; pinned real Claude demo within a fixed observable bound |
| R5 — enrolled and namespace compatibility | Existing surface suites rerun through the new resolver against default, custom, and legacy namespace fixtures | Named-value differential tests, invocation-proof regression, missing authored/managed state outcomes, real CLI process |
| R6 — hydration, activation, shadowing, durable fallback | Integration extends a real canonical install plan from a global fixture, applies it, verifies the local tree, and compares immutable global bytes | Unit copy/no-op/conflict/corrupt-source tables; activation-last and drift tests; custom namespace hydration; branch/missing-overlay Git fixture; local-write/no-global-write proof |

Affected-surface wiring is explicit: Claude Code uses a generated plugin workflow plus one pinned real-host demo; OpenAI Codex uses the packaged plugin skill and its installed runtime; OpenCode uses the profile plugin through the pinned CLI/TUI conformance harness; Cursor uses installed rules/hooks through Cursor's artifact harness; Safeword CLI uses a real command process. Every surface begins outside the resolver, and the external observer—not Safeword's own log—proves read/write timing and mutation bounds.

### Build order

1. RED/GREEN the pure identity and user-data-root tables, then real Git worktree and non-Git fixtures. This proves the shared-knowledge/isolated-state model before other code depends on it.
2. RED/GREEN root-level context resolution and precedence, including existing-local compatibility, exact-global-over-ancestor, ancestor choice, unavailable global storage, and no per-file fallback.
3. RED/GREEN logical `namespaceRoot`/`stateRoot` plumbing for representative ticket, invocation-proof, and mutable-state consumers; add route catalogue rejection tests before migrating the remaining catalogued consumers.
4. RED/GREEN the coordinator's choice, builder-input provenance, automatic global convergence, concurrent re-resolution, and consume-once resume behavior; wire the real CLI and representative BDD/review paths first.
5. RED/GREEN canonical plan hydration: classify global records, add copy/no-op/conflict effects, verify destinations, write the activation receipt last, and prove global bytes never change.
6. Wire Claude, Codex, OpenCode, and Cursor installed artifacts and complete catalogue parity. Regenerate Codex/Claude artifacts from canonical sources; never edit generated files.
7. Run the 69-scenario Cucumber lane and focused Vitest suites, then the broader integration, typecheck, lint, parity, schema, and release-contract checks required by touched surfaces.
8. Update `README.md` and `packages/website/src/content/docs` with the point-of-need choice, automatic private fallback, later hydration, conflict stop, local-only writes, and the preserved-snapshot limitation.

The plan has four major components and eight dependent slices, so the plan-implementation split trigger is not met. Individual TDD loops remain one scenario at a time through the ledger.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --------- | ---------- | -------------- | -------------- | --------------- | ------------------- | -------------------------------------- |
| https://git-scm.com/docs/git-worktree | 2026-09-13 | Git 2.54 manual; behavior present in local Git 2.50.1 | Git 2.50.1 and later supported by the host | Git explicitly separates shared common-directory metadata from per-worktree HEAD, index, and private directories | Use Git's common identity for shared knowledge and worktree identity for mutable state | Documentation evidence only; do not read or write Git internals directly; invoke rev-parse; Git is GPL but no source is copied |
| https://git-scm.com/docs/git-rev-parse | 2026-09-13 | Current Git manual; local Git 2.50.1 | Git 2.50.1 | `--git-common-dir`, `--absolute-git-dir`, and `--show-toplevel` expose supported discovery instead of parsing `.git` files | Derive identity through Git's public CLI and hash canonical outputs | Repository moves can change path-derived identity and are explicitly out of scope |
| https://code.visualstudio.com/api/extension-capabilities/common-capabilities | 2026-09-13 | Documentation updated 2026-09-09 | Safeword 1.0.0-rc.3 on Node 22, 24, and 26 | VS Code separates workspace-specific storage from global extension storage and restores it for the same workspace | Keep project-scoped data outside the project without treating it as application-global state | Product API is not reused; documentation is MIT-licensed, and only the storage boundary transfers |
| https://specifications.freedesktop.org/basedir-spec/latest/ | 2026-09-13 | XDG Base Directory Specification 0.8 | Safeword 1.0.0-rc.3 | XDG distinguishes durable user data from restart-oriented state and defines absolute-path validation and defaults | Put durable private contexts under the user data root and reject invalid relative overrides | XDG is Unix-focused; Windows uses LOCALAPPDATA and inherited ACLs; no specification text is copied into runtime |

**Decision impact:** changed: the earlier plan rejected user-private state and used ephemeral stop/stateless outcomes; current evidence and accepted behavior require a first-class project-scoped global context while retaining explicit repository consent.
**Decision informed:** Partition global context with Git's common/worktree identity split and canonical-path fallback.

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Partition global context with Git's common/worktree identity split and canonical-path fallback. | Hash canonical `--git-common-dir` for knowledge and `--absolute-git-dir` for mutable worktree state; hash the canonical directory for non-Git contexts | One canonical checkout hash; generated global project UUID registry | Checkout-only identity cannot share linked-worktree knowledge; a registry adds mutation, relinking, collision, and recovery behavior beyond the accepted move boundary |
| Select one authoritative context root per operation. | Activated local namespace/state roots shadow global as a whole; missing overlay selects global as a whole | Per-file local-then-global union; local-to-global write-through | A union resurrects stale values when local files are intentionally missing and weakens existing missing-knowledge behavior; write-through was explicitly rejected and destroys the preserved snapshot |
| Hydrate global data through the canonical lifecycle plan and activate local last. | Add copy/no-op/conflict effects to the reviewed plan, verify every destination, then write a local activation receipt while leaving global unchanged | Ad-hoc pre-install copy; lazy copy on first read; destructive move | All alternatives mutate outside the reviewed plan, can silently overwrite, or retire the only durable fallback |
| Centralize context policy while preserving native consent adapters. | Pure resolver/coordinator behind the integration and route catalogues; host adapters translate builder input and output | Generated prose only; one universal hook payload | Prose cannot guard agent-authored access, while host hook/approval contracts are not interchangeable |
| Use platform user-data directories and existing standard-library primitives. | XDG data root on Unix, LOCALAPPDATA on Windows, hashed paths, durable writes, owner-only modes where supported, no new package | Reuse one agent's profile directory; add a platform-dirs dependency | Agent profile storage breaks host parity; the standard library and existing helpers cover the bounded path and permission contract |

**Figure-it-out verdict:** Recommend the Git-native two-level partition because it is the only candidate that satisfies linked-worktree sharing and mutable-state isolation without a second identity lifecycle. The canonical-checkout hash loses sharing; the UUID registry loses on bloat and recovery surface. **Premortem:** if this choice fails, path-derived identity after a repository move strands the snapshot; keep arbitrary moves out of scope and add a relink command only when evidence justifies it.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | One plain-language choice appears only at state need; automatic private fallback needs no ceremony; typed plan/conflict evidence remains available | `packages/cli/features/quiet-unenrolled-reviews.feature` | |
| Structure enforces; instructions suggest | Route parity and host boundaries make unguarded state access fail; independent filesystem observation proves timing and mutation | `packages/cli/features/quiet-unenrolled-reviews.feature` | |
| Fire at boundaries, not every turn | Resolution runs only on the first declared state need or a Safeword-owned target; simple surface loading performs no project-state check | `packages/cli/features/quiet-unenrolled-reviews.feature` | |
| Add, never replace | Canonical reconciliation owns repository effects; conflicts never silently choose a side; global bytes remain intact | `packages/cli/features/quiet-unenrolled-reviews.feature` | |
| Correct and safe; then clear; then simple | One resolver and one installer are reused; no dependency, union filesystem, registry database, or write-through path is added | `.project/tickets/EM9ZSV-quiet-unenrolled-reviews/design.md` | |

Architecture decisions honored: **Registry-Driven Agent Integrations with Native Trust Boundaries**, **Explicit Project Enrollment for Profile-Scoped Codex Hooks** as superseded only for user-private fallback, and the new **User-Private Project Contexts Beneath Explicit Repository Enrollment** record in `ARCHITECTURE.md`. `design.md` owns the four component interfaces and physical layout.

## Known deviations

- The new architecture deliberately supersedes the earlier rejection of user-cache state. That rejection assumed global state had no independent project value; accepted BDD tickets, knowledge, logs, and review proof now provide that value. Repository installation remains explicitly consented and plan-driven.
- XDG data paths are used for the cross-host Unix CLI, including macOS, instead of a GUI bundle's `Library/Application Support` path. This matches Safeword's existing CLI configuration convention and keeps host parity; Windows uses LOCALAPPDATA.

## Doc impact

- `README.md`: explain point-of-need local setup, automatic global fallback, and the fact that global preserves only the pre-install snapshot.
- `packages/website/src/content/docs`: update workflow and installation guidance for containing projects, global privacy/isolation, hydration conflicts, branch fallback, and recovery when global storage is unavailable.
- Canonical skill/hook templates and generated Claude/Codex bundles are runtime artifacts. Update the canonical source, then regenerate and verify parity in build step 6.

## Assessment triggers

- Git changes or removes the common-dir/worktree-dir discovery contract on a supported version.
- Real users need global context to survive arbitrary repository moves or copies; that would justify an explicit relink/registry decision.
- A supported host cannot expose builder-input provenance before repository mutation; that surface must fail to global instead of inferring consent.
- More than one consumer cannot accept separate `namespaceRoot` and `stateRoot` without a compatibility layer, suggesting a typed logical-filesystem boundary.
- Hydration cannot be represented by the existing content-addressed lifecycle plan without a second apply engine.
- Owner-only storage cannot be established on a supported platform, requiring a platform-native ACL adapter or a narrower support claim.
- Per-context lookup materially exceeds the existing common-operation hook budget.
