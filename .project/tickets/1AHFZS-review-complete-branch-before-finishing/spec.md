# Product Plan: Review complete branch changes before builders finish

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** BDD currently calls for a "whole diff" quality review at implementation exit, but the review tool accepts caller-selected files and bounded content. A builder can finish believing the complete branch and ticket intent were checked when the reviewer saw less. Recent MCP feedback showed the value of explicit base/head, requirements, comparable code, and prioritized findings. The oversized generated-file fix in PR #5151 has merged, but it does not itself select and account for the complete branch change set at BDD implementation exit.
- **Persona outcome inventory:** Technical Builders can see which branch changes were reviewed against the ticket and rerun after code changes. Non-Technical Builders get a plain account of findings, omissions, and the next action without reading a diff.
- **Known facts:** The BDD implementation-exit guide requests a whole-diff quality review; the current review command accepts bounded caller-selected targets; the completed oversized-generated-file work does not supply automatic branch inventory.
- **Assumptions:** BDD implementation work has a Git integration branch from which a merge base can be computed; an empty or unavailable branch inventory must not be described as a completed branch review.
- **Unresolved product decisions:** None. The builder approved the original fifteen examples. Four later examples clarify rejection and freshness boundaries within those same accepted Rules, under the builder's instruction to continue the agreed work. All nineteen passed renewed scenario review; no scope edge changed. Implementation details for path classification, host enforcement, and receipt storage belong in the Implementation Plan.
- **Expected outcome:** At implementation exit, the builder gets an actionable review of the branch against the ticket's intended behavior and can tell exactly which revision and changes the conclusion covers.
- **Success threshold:** A representative multi-scenario BDD branch yields a review that identifies its base and head, accounts for every changed path, uses the ticket's behavior as context, and either reports actionable findings or explicitly says which evidence could not be reviewed. A later code change cannot inherit the earlier review as current coverage.
- **Project non-goals:** No extra review on every edit or RED/GREEN step; no replacement for existing PR readiness or GitHub PR review; no claim that bounded AI context proves every byte was semantically reviewed.
- **Reversibility:** One-way once the branch-scoped review command is installed in customer projects: its CLI contract and coverage meanings may be relied on. No customer data migration is planned.

## Jobs To Be Done

### branch-review.TBU1 — Check the whole change before calling implementation complete

**Persona:** Technical Builder (TBU)

> When a BDD ticket's scenarios are implemented across several commits and files, I want a reviewer to assess the complete branch against the ticket's behavior and existing code, so I can fix cross-file mistakes before declaring implementation complete.

#### branch-review.TBU1.R1 — The review accounts for every committed branch change from merge base to current head and assesses eligible authored changes against the ticket's intended behavior; uncommitted work is named and prevents complete coverage

#### branch-review.TBU1.R2 — The review gives prioritized, actionable findings that can connect mistakes across changed files

#### branch-review.TBU1.R3 — Implementation exit rejects a changed review snapshot before advancing; afterward, changes to authored branch work or ticket goals require a fresh review, while routine phase, timestamp, Work Log, verification, and audit records do not

#### branch-review.TBU1.R4 — Implementation exit checks the review's base, head, working tree, path accounting, and ticket behavior before advancing; partial coverage may proceed with recorded agent acknowledgement and disclosure, while no branch review requires the existing reasoned-skip path

### branch-review.NTB1 — Know whether the branch review actually covered the work

**Persona:** Non-Technical Builder (NTB)

> When my agent says a feature is ready, I want a clear account of what was reviewed, what could not be reviewed, and what needs attention, so I can trust the claim without reading the diff myself.

#### branch-review.NTB1.R1 — The result identifies reviewed and omitted changes and never calls incomplete coverage a complete review

#### branch-review.NTB1.R2 — The result explains findings, gaps, and the next action in plain language

#### branch-review.NTB1.R3 — The result reports freshness separately from coverage: current or stale, and complete, partial, or none; an empty change inventory or missing base never claims a completed branch review, and omitted paths and failed passes remain visible even when the review becomes stale

## Shape

### M1 — Trust the implementation-exit branch review

- **Outcome:** A builder finishing a multi-scenario BDD feature sees a task-aware review of the branch, with the reviewed revision and any coverage gaps named.
- **Contract:** The shared review command selects the active ticket and computes the merge base of HEAD against the configured integration ref, defaulting to the remote default branch; callers cannot narrow it. It inventories every committed diff path, including paths matching ignore rules, plus nonignored staged, unstaged, and untracked work. Bounded review passes assess authored changes against the ticket's accepted goals and scenarios. Every selected path is either reviewed or named as omitted with a reason. Sensitive content is withheld before dispatch and named as an omission; the system does not promise a complete secret scan. The result names the base, head, actual reviewer, findings, reviewed and omitted paths, freshness (`current` or `stale`), and coverage (`complete`, `partial`, or `none`). Dirty work is named and cannot yield complete coverage. An empty inventory or missing base yields coverage `none`, says no branch work was reviewed, and cannot alone satisfy multi-loop implementation exit. A current partial result can proceed after the agent records a receipt-bound decision and discloses the omissions; `none` uses the existing explicit reasoned-skip path. The implementation-exit check validates the full reviewed snapshot before the phase write. Later checks compare the reviewed branch work and ticket goals, so a new authored change requires another review while routine phase, timestamp, Work Log, verify, and audit records do not. A later commit with identical reviewed content does not alone make the result stale. The review claim is limited to the merge-base diff; work already merged into the integration branch is outside it and never described as reviewed ticket work.
- **Non-goals:** A new review stage, PR review changes, or a guarantee that a reviewer understood every interaction across separate bounded passes.

## Killer Demo

> For a builder whose agent finished a feature across several files, the existing implementation-exit review names the branch revision, checks its authored changes against the ticket, and shows every omitted path, so the builder can see what was actually reviewed before moving to verification.

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- Cursor
- OpenCode
- Safeword CLI

Unaffected:

- GitHub Pull Request Conversation — the existing PR review and readiness flow stays separate.
