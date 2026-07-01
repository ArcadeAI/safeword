# Dimensions: Cloud retro filing — try-REST-then-agent-subagent transport (BNGK9W)

Derived from spec.md (SM1/TB1/NTB1 ACs, done_when) + the reconciled two-path design
(spool → try-REST → mark-filed; PATH B nudge off the async Stop hook) + domain
knowledge (transport selection, spool state, surfacing phrasing, dedupe/drain).

| Dimension                   | Partitions                                                                                                              | AC        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------- |
| Transport selection         | valid token → REST files in-hook; 401/absent token → REST skipped/failed, drafts left spooled for the agent path        | SM1.AC1/AC2 |
| Spool on REST failure       | REST throws/401 → drafts remain spooled (not lost); REST success → those drafts drained from the spool                  | SM1.AC1   |
| Local silent path           | valid token present → files via REST AND emits no surfacing (zero footprint)                                            | SM1.AC2   |
| Mark-filed / drain          | a draft filed (either path) → removed from spool; a second boundary sees no unfiled drafts → no re-nudge, no double-file | SM1.AC3   |
| Extraction/spool silence    | any path → the async Stop hook adds nothing to the conversation                                                         | TB1.AC1   |
| Fallback nudge — presence   | unfiled spooled drafts exist at a boundary → one factual line surfaced; none exist → silent                             | TB1.AC2   |
| Fallback nudge — phrasing   | the surfaced line is a STATEMENT, not an imperative (no leading run/file/please/you-must)                               | TB1.AC2   |
| Fallback nudge — cadence    | fires once per unfiled batch (not every boundary while the batch is pending), never mid-turn                            | TB1.AC2   |
| Spool egress-safety         | only `{signature,title,body,labels}` (post-egress) written; raw finding text / off-schema fields never on disk          | NTB1.AC1  |
| Fail-open                   | spool write throw / REST throw / surfacing error → never breaks Stop or the prompt; drafts retained                     | TB1.AC1   |

**Test layers:**

- **Unit (pure):** the transport-selection decision (token-valid → REST path; else
  spool-and-defer), the spool drain/mark-filed helper, and the nudge decision
  (unfiled-drafts-present → factual line; phrasing is a statement; once-per-batch) —
  injected deps like the offset-state / self-report tests.
- **Module (wiring):** `retroCommand` / `runRetro` with a mock `IssueTracker`:
  REST success → drafts filed + spool drained + no surfacing; REST throw → drafts
  retained in the spool + outcome signals defer-to-agent.
- **Hook-level:** the surfacing hook (SessionStart / UserPromptSubmit) — emits the
  factual line only when unfiled drafts exist, and is a statement not an imperative.
- **Command-level:** the filing-subagent path is an agent boundary (real MCP) —
  covered by a wiring test at the spool→transport seam (reads spool, posts each
  draft body verbatim), the MCP call itself mocked.

**Boundaries mocked:** the GitHub transport (REST mock + the agent/MCP filing seam)
and the spool fs (injected `projectDirectory`, as the shipped `draft-spool.ts`
tests do). Transport selection, spool drain, and nudge decision run real.

**Already shipped (slice 1):** `draft-spool.ts` (`spoolDrafts`/`readSpooledDrafts`,
capped/fail-open/torn-tolerant) with 5 unit tests — the NTB1.AC1 egress-safe spool
substrate. Remaining slices wire selection + drain + nudge on top.
