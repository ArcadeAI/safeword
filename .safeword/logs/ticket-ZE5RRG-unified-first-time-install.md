# Work Log: Give users one coherent Safe Word command model

**Anchored to:** `.project/tickets/ZE5RRG-unified-first-time-install/ticket.md`

---

## Session: 2026-08-04

- [14:40] Created GitHub issue #1925 before further local mutation and adopted it as the ticket's external identity.
- [14:41] Resumed from define-behavior. User confirmed scenario completeness by directing execution to proceed; advanced to scenario-gate.
- [14:41] Next: run the prescribed review-spec checks and independent scenario-gate coordinator before implementation planning.
- [14:43] Scenario gate: opposite-agent reviewer returned Healthy with no changes; recorded a cross-agent scenario-gate stamp (Codex author, Claude reviewer).
- [14:44] Planning decision 1: choose how install/plan/uninstall/status/doctor share lifecycle truth; wrong means preview and apply can drift or aliases become parallel products.
- [14:44] Ideal options for decision 1: (A) one typed lifecycle intent/effect plan consumed by preview and apply, with status/doctor as distinct observers; (B) a thin install orchestrator that sequentially invokes existing setup/Claude/Codex handlers while plan/uninstall remain separate; (C) command-specific handlers sharing only an agent-selector parser.
- [14:44] Planning decision 2: choose how retained aliases reach canonical behavior; wrong means compatibility routes silently diverge or become a second documented API.
- [14:44] Ideal options for decision 2: (A) catalogue-owned normalization into one canonical invocation before dispatch; (B) legacy handlers delegate to canonical handlers; (C) keep separate legacy implementations and assert parity in tests.
- [14:44] Research domains: lifecycle intent/effect modeling; reconciliation ownership; partial-failure and retry semantics; CLI alias/help discoverability; compatibility metadata and structured guidance; highest-practical-scope proof; installed Commander/Bun/Vitest constraints; existing architectural decisions and reusable collaborators.
- [14:48] Evidence: the accepted Typed CLI ADR requires Observe → Plan → Confirm → Apply → Verify → Report and catalogue-owned aliases/effects; `reconciliation.ts` already supplies stable project plan identities; Claude and Codex installers already return/are adapted into typed results with activation guidance; Commander 15 supports hidden commands, hidden options, strict choices/custom parsers, and local/global option merging; the CLI guidelines favor one guessable path, idempotence, dry-run safety, and explicit compatibility.
- [14:49] Steelman lifecycle option B: sequentially composing setup plus the existing profile handlers is the smallest diff and preserves battle-tested behavior. It loses because today's plan covers only reconciliation, setup still emits separate plugin handoffs, Cursor is embedded in the default schema, profile removal has no shared exact-plan contract, and apply could introduce effects absent from preview.
- [14:49] Lifecycle options C and command-specific handlers are locally simple but create several sources of truth for selection, effects, failure aggregation, and retries; their regression surface grows with every lifecycle command.
- [14:50] Decision 1: use one typed lifecycle request/plan/executor. Reuse existing reconciliation and profile collaborators behind surface adapters; compute a side-effect-free plan first, preflight offline/selection/consent against it, apply selected surfaces in a deterministic order, and aggregate completed effects without rollback across independent surfaces.
- [14:50] Steelman compatibility option B: handler-to-handler delegation matches the current catalogue and costs little. It loses because `setup --yes`, agent-specific installs, project-only remove/reset, and architecture option aliases need semantic translation; delegating handlers would leak legacy vocabulary into canonical code.
- [14:50] Decision 2: normalize command and option compatibility declaratively in the catalogue before dispatch. Canonical handlers receive only canonical options; compatibility findings name the exact replacement and an indefinite retention policy.
- [14:51] Recommendation: typed lifecycle orchestration plus catalogue normalization. This is correct because preview, apply, help, capabilities, and aliases share the same request model; elegant because existing surface collaborators remain intact; cost is a new orchestration layer and explicit schema ownership projection. Evidence: `ARCHITECTURE.md` “Typed CLI Execution and Discovery”, Commander 15.0.0 docs, https://clig.dev/, current host `plugin uninstall/remove --help`, and the approved 48-scenario packet.
- [14:51] Premortem: six months from now this fails if the lifecycle planner predicts broad surface effects while collaborators perform finer unplanned mutations; mitigate now with effect-authorization tests at the production command boundary and one declared adapter contract per surface.
- [14:51] Next: author `design.md` and `impl-plan.md` with schema partitions, surface adapter contracts, proof mapping, and a load-bearing default-install slice.
- [15:02] Plan artifact validation: Prettier clean; impl-plan parser/transition suites passed 35/35.
- [15:05] Independent plan review blocked: preferred opposite-agent route produced no verdict and the fallback did not complete safely. Following the coordinator's single recovery action with one exact retry; remaining in plan-implementation.
- [15:07] Independent plan retry returned Healthy with no changes; wrote a cross-agent plan-implementation stamp.
- [15:07] Advanced to implement because `designApprovalGate` is absent. First slice: production CLI default install RED with Claude/Codex subprocess boundaries stubbed and Cursor byte snapshot.
