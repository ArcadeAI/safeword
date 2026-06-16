# Impl Plan: Set an autonomy posture and resolve trusted decisions autonomously

**Status:** planned

## Approach

The spine is three layers — a policy resolver, the breakpoint interception, and the always-on guards — built in dependency order so each rests on green.

1. **Policy resolver (pure, unit-layer).** A single module that resolves the effective per-axis posture from: built-in preset maps (Full review / Guard the contract / Hands-off) → project config → personal override, with documented precedence (personal > project > preset > default Full review). Pure function over parsed config; invalid input rejected, malformed/unreadable input fails safe to Full review. Covers DEV1.AC1–AC6, DEV2.AC1/AC3/AC4, SM1.AC1/AC3. **Unit tests** — no agent session needed; this is the bulk of the logic and the highest-value test layer.
2. **Personal-override storage (integration-layer).** Gitignored local config (proposed `.safeword/config.local.json`) plus the ignore-rule entry. Covers DEV2.AC2. **Integration test** against a temp repo (assert staging leaves it untracked).
3. **Breakpoint interception + resolution sub-agent (integration-layer).** At each would-be HITL pause, consult the resolver; on `autonomous`, dispatch the sub-agent with the defined context contract, run `/figure-it-out`, log the resolution; on `ask`, pause. Fail-safe defer on transient-error-after-retry and on inconclusive. Covers DEV3.AC1–AC5, SM1.AC2. **Integration tests** with a stubbed `/figure-it-out` (inject success / transient-error / inconclusive) — no live LLM, keeps it deterministic.
4. **Always-on guards (integration-layer).** Confirm denylist, hard gates (LOC/done/verify), and done-confirmation are consulted independent of posture. Largely asserting existing guards still fire when posture=autonomous. Covers DEV5.AC1–AC3.

Build order: 1 → 2 → 3 → 4. The Cucumber acceptance lane (`features/autonomy-posture-spine.feature`) rides on top of the integration step definitions; SM1 stays unit-only by design.

## Decisions

| Decision                     | Choice                                                                               | Alternatives considered                       | Rejected because                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Policy storage               | Extend `.safeword/config.json` (project) + gitignored `config.local.json` (personal) | New dedicated policy file; env-var activation | Reuses the existing config surface and reconciliation; env-var was G2E72G out-of-scope |
| Precedence model             | personal > project > preset defaults > Full review                                   | project wins; merge/union                     | Personal-wins is the spec contract (DEV2); union is ambiguous for a single posture     |
| Autonomous resolution engine | Reuse `/figure-it-out` via a sub-agent                                               | New bespoke decision engine                   | No-bloat; `/figure-it-out` already does evidence-based decisions                       |
| Failure handling             | Retry-once on transient, defer on inconclusive, never proceed                        | Always-proceed (G2E72G); always-abort         | Selective-prediction reject-option; always-proceed compounds silent errors             |
| `/figure-it-out` in tests    | Stub/inject outcomes at the integration boundary                                     | Live calls in the acceptance lane             | Determinism + cost; live calls flake and burn tokens                                   |

## Arch alignment

Honors, from `ARCHITECTURE.md`:

- **Config Schema** (§154) and **Schema (`src/schema.ts`)** (§278) — policy fields and the personal-config path register through the schema as the single source of truth.
- **Continuous Quality Gates (LOC + Phase + TDD)** (§487) — the always-on hard gates this feature must not weaken under autonomy.
- **Add, never replace** (PRINCIPLES.md §3) — autonomy layers onto the existing config and gates without overwriting them.

## Known deviations

skip: no deviations planned — the spine reuses the config schema, hook enforcement, and `/figure-it-out` as-is. The control-ladder children (verify/debate/async-audit) may introduce new patterns; that is their concern, not this ticket's.

## Assessment triggers

- The control-ladder child lands — autonomous resolutions stop being log-only (tier-3) and gain verify/debate tiers; revisit the resolution path.
- A third config layer appears (e.g. per-ticket toggle, or org-level policy) — revisit the precedence model.
- `/figure-it-out` cost on long autonomous runs proves material — revisit the stub boundary and add the deferred cost ceiling.
- The breakpoint taxonomy (which in-session pauses map to which axis) needs to expand beyond the v1 set.
