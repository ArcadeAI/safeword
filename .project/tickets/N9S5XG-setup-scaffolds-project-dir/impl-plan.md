# Impl Plan: Fresh safeword setup scaffolds .project/

**Status:** implemented

## Approach

Build order, each step green before the next:

1. **Context carries the root** — `createProjectContext(cwd)` (`packages/cli/src/utils/context.ts`) gains `namespaceRoot: resolveNamespaceRoot(cwd)`, computed once (SM1 ethos from TAGWZ8). **Unit layer.**
2. **Planning-time translation** — a small `translateNamespacePath(path, ctx)` in the reconcile module maps the schema's legacy-prefixed entries (`.safeword-project/...`) onto the resolved root before planning. Applied in `computeInstallPlan` (directories + managed files), the upgrade plan, the diff plan, and the reset plan's preserved-dir handling. The `SAFEWORD_SCHEMA` constant stays static. **Unit layer** via planner outputs.
3. **Setup/upgrade/diff/reset end-to-end** — the 11 scenarios run as integration tests against the real commands in temp repos (fresh / arcade-adopt / partial-adopt / legacy / both-dirs / configured-root / reset / diff / upgrade-both-roots). **Integration layer** — these are the ticket's deliverable proof.
4. **Full suite + fresh build** — settles any fixture that assumed setup scaffolds legacy paths.

## Decisions

| Decision                         | Choice                                           | Alternatives considered                                           | Rejected because                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where the root lives             | `ProjectContext.namespaceRoot`                   | Re-resolving per planner call                                     | Context is created once per command run — resolving there matches TAGWZ8's compute-once design and keeps planners pure                                                               |
| How schema paths follow the root | Translate legacy-prefixed paths at planning time | Schema factory `buildSchema(ctx)`; parameterized template strings | Factory churns every schema consumer for one prefix swap; translation is one function at the plan boundary, and the schema stays a readable static manifest (schema-as-manifest ADR) |
| Translation direction            | Legacy prefix → resolved root                    | Adding `.project/` entries alongside legacy ones                  | Additive entries would scaffold BOTH namespaces — the exact split-brain the epic forbids                                                                                             |

## Arch alignment

Consulted `ARCHITECTURE.md` (repo root):

- **Schema as single manifest** — preserved: the manifest stays static; only the plan-time path realization becomes root-aware.
- **Reconciliation engine modes** — install/upgrade/diff/reset all flow through the same planners, so one translation point covers AC4's "every lifecycle command agrees".

## Known deviations

Recorded at reconciliation (implement-phase exit):

- **`namespaceRoot` is optional on `ProjectContext`** — the plan implied a required field; older test callers construct contexts by hand, so reconcile falls back to resolving from `cwd` when absent. Same behavior, looser contract.
- Otherwise as planned — `withResolvedNamespaceRoot` is the single translation seam at reconcile entry; identity translation on legacy repos.

## Assessment triggers

- If a future schema entry needs to _stay_ legacy-pinned while others translate, the blanket prefix translation needs an opt-out flag — revisit then.
- When 9MMWS7 implements the upgrade migration, it should reuse `ctx.namespaceRoot` rather than re-deriving state.
