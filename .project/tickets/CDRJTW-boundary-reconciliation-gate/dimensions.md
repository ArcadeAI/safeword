# Dimensions: boundary reconciliation gate (CDRJTW)

Derived from spec.md (SM1.AC1–3, TB1.AC1–2) + the #888 environment method
(first live trial): rides-on inventory crossed with the five guide words,
then behavioral dimensions.

## Rides on

1. **Git state** — the staged diff (commit), the outgoing range (push), HEAD, reachable history.
2. **Ticket artifacts on disk** — ticket.md frontmatter, test-definitions.md, verify.md, impl-plan.md; written by agents, humans, or forgers.
3. **The invoking context** — hook shims (.husky), a safeword project root, a bun/node runtime.
4. **The audit file** — `.safeword/boundary-audit.jsonl` as append target.

## Environment dimensions (guide-words × rides-on)

| Dimension (guide word × item)                          | Partitions                                                                                                          | AC            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------- |
| Git history gone/partial                               | anchor/ledger SHA real but unreachable (forge OR shallow clone — same verdict, warn names both possibilities)       | SM1.AC2       |
| Git history rewritten                                  | SHAs recorded pre-rebase → canonicalize via patch-id and pass; entered-phase-only demanded (commitless multi-phase) | SM1.AC2       |
| Git state other cadence                                | push range containing no ticket-artifact changes; commit with nothing ticket-related staged                         | TB1.AC1       |
| Ticket artifacts gone/partial                          | staged ticket.md with unparseable frontmatter (warn, never crash); feature ledger absent                            | SM1.AC1       |
| Ticket artifacts other hands                           | feature ticket at rest born past intake with no skips (#675); well-formed forged anchor (→ push tier)               | SM1.AC1/AC2   |
| Ticket artifacts many at once                          | several tickets touched in one commit — each reconciled, verdicts grouped per ticket                                | SM1.AC1       |
| Invoking context gone/partial                          | not a git repo; not a safeword project; audit directory missing (create it)                                         | TB1.AC1/SM1.AC3 |
| Audit file many at once / cadence                      | entries accumulate across runs; unbounded growth accepted this slice (recorded as known limitation)                 | SM1.AC3       |

## Behavioral dimensions

| Dimension            | Partitions                                                                                                 | AC          |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ----------- |
| Tier split           | commit = content-only checks (sub-second, no git subprocess); push = + history-backed SHA verification       | SM1.AC1/AC2 |
| Verdict outcome      | all checks pass (quiet success + audit entry); findings (warnings + audit entry); exit 0 in every case      | SM1.AC1, TB1.AC2 |
| Relevance gating     | ticket artifacts in change → reconcile; none → silent no-op, no audit entry                                  | TB1.AC1     |
| Check composition    | phase legality (incl. birth), anchors, ledger, verify.md shape, impl-plan shape — each independently reported | SM1.AC1     |

**Known limitations (recorded, not scenarios):** audit-file growth unbounded
(revisit when it matters); `--at pr` profile deferred to child 3; hand-edited
`.husky` shims removed by a host are their prerogative (dogfood repo only this
slice).

**Test layers:** engine verdicts + relevance gating + parsing edge cases →
**unit** (pure engine over fixture content + stub resolver). Command behavior,
tier split, audit append, exit codes, real git history (rebase, unreachable,
shallow-like) → **command** (runCli against temp git repos, the check.test.ts
pattern). Dogfood shim wiring → proven by this ticket's own commits (the hook
runs on them) + one assertion that .husky lines exist.
