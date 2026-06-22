# Impl Plan: epic + blocked_on schema and the blocked_on phase gate

**Status:** planned

## Approach

Three components, built bottom-up so each task lands on green:

1. **Schema parse (shared, unit).** Recognize two canonical optional fields: `epic` (scalar slug-or-id) and `blocked_on` (inline array). Reuse `parseTicketIdList` from `utils/ticket-relations.ts` for `blocked_on` — conforms to the hand-rolled scalar frontmatter parser (no `yaml` pkg). _Covers AC1._ Test layer: **unit** (extend `ticket-relations.test.ts`).
2. **Warn-only validation (unit).** Extend `health.ts:findRelationAdvisories` to feed `blocked_on` edges through the existing `findDanglingDependencies` (unresolvable → warn) and `findTicketsInCycles` (cycle + self-cycle → warn); clean corpus silent. _Covers AC2._ Test layer: **unit** (the finders are pure over fixtures) + one **integration** subprocess assert that `safeword check` exits 0 with the warning.
3. **The gate (`pre-tool-quality.ts`, integration).** New check joining the phase-gate family: on a Write/Edit whose _proposed_ ticket.md frontmatter moves `phase` out of `intake`, walk `blocked_on`; `deny()` unless every same-repo blocker is `done`. Terminal-not-done (`cancelled`/`superseded`/`wontfix`) → still deny unless a non-trivial `blocked_on_override` is present; unreadable/missing status → fail safe (deny); cycle → short-circuit and surface as the block reason; grandfather (fire only on the intake→ transition). _Covers AC3, AC4, AC5._ Test layer: **integration** (hook invoked with a simulated tool payload, `packages/cli/tests/hooks/`).
4. **Stale-override warning (unit, `health.ts`)** + **INDEX override surfacing (integration, `ticket-sync/index.ts`).** _Covers AC4 tail._

**Build order:** (1) parse → (2) validation warnings → (3a) gate happy/deny core (done-allows, in_progress-denies, multi-blocker, unreadable) → (3b) override mechanics (terminal-not-done, substantive allows, trivial rejected) → (3c) grandfather + non-phase-edit + cycle short-circuit → (4) stale-override warning + INDEX surfacing → docs (`ticket-template.md` documents both fields). The gate (3) depends on parse (1); validation (2) is independent and lands first as the cheapest RED→GREEN.

## Decisions

| Decision                    | Choice                                               | Alternatives considered                      | Rejected because                                                                                                             |
| --------------------------- | ---------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `blocked_on` representation | inline array `[id,…]` via shared `parseTicketIdList` | YAML block list; scalar CSV                  | conforms to the hand-rolled scalar frontmatter parser (AKZJXC precedent); avoids a `yaml`-package swap touching every reader |
| Gate placement              | new check in `pre-tool-quality.ts`                   | a separate hook; enforce in `safeword check` | enforcement must sit at the Write boundary (only place it can block a tool-mediated edit); reuse existing `deny()` infra     |
| Auto-unblock status         | only `done`; terminal-not-done needs override        | all terminal states unblock                  | GitHub Actions `!cancelled()` — abandoned ≠ finished; surfaces a human decision                                              |
| Override field              | single `blocked_on_override: <reason>` per advance   | per-blocker map                              | lean v1; one reason for the advance                                                                                          |
| Unreadable blocker status   | fail safe → treat non-done, deny                     | skip / allow                                 | safety: an unparseable blocker is not provably done                                                                          |

## Arch alignment

Honors **Hooks (Claude Code hooks enforce gates)** — the gate is a new member of `pre-tool-quality`'s phase-advancement family, not a new enforcement mechanism. Honors the **shared ticket-relations module + hand-rolled scalar frontmatter parser** convention established by AKZJXC (reuse, no new parser). Honors the **Schema manifest** requirement — the `ticket-template.md` doc change is already a schema-tracked owned file; no new untracked template.

## Known deviations

`skip: no deviations planned` — every piece extends an existing pattern (the deny()-based phase-gate family, the relations finders, the scalar parser). The gate inspecting the _proposed_ frontmatter from the Write payload (not disk) matches how the existing scenario-gate already works — not a deviation.

## Assessment triggers

Revisit if: cross-repo references gain a syntax (changes "unresolvable → warn" to a distinguishable case); `parent`/`paired_with` get a real consumer (the deferred fields return); a per-blocker override need appears (the single-reason choice); or non-tool-mediated edits (a human in vim) need gating — which would require a different enforcement layer (e.g. a git pre-commit), out of this design's reach.
