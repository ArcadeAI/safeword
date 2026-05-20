# Dimensions — Ticket 153

Derived from intake (resolved evidence + verified primary sources), scope (epic-anchor hook + replan-on-resume + verify soft-prompt), done_when (10 observable criteria), and domain-knowledge boundary cases (heading parsing, mid-session edits, sub-agent failure).

## Decisions baked in

Five open questions resolved during scenario drafting, recorded here so scenarios assume them as given:

| #   | Question                                    | Decision                                                                                  | Rationale                                                                            |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Stub format when `## Contracts` exceeds cap | Static stub: `[epic <id>] ## Contracts section exceeds injection budget; see <epic-path>` | Deterministic, no LLM call, predictable for tests                                    |
| 2   | Missing epic file behavior                  | Silent no-op + stderr warning                                                             | Doesn't crash; warning visible in hook log; matches Safeword's other graceful no-ops |
| 3   | Sub-agent failure (timeout/error)           | Silent fallback; stderr log; `last_modified` still updates                                | Prevents indefinite re-debate loop on persistent failure                             |
| 4   | User edits a proposal partially             | `last_modified` updates once at replan-complete regardless of subsequent user actions     | Single update point; no race between replan-complete and user-accept                 |
| 5   | Epic with no `## Contracts` section         | No-op (not an error)                                                                      | Epics without cross-ticket contracts shouldn't force a stub                          |

Plus three baked into the parser:

| #   | Question                        | Decision                                                                                       |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| 6   | Heading match strictness        | Strict literal match on `## Contracts` (level-2, exact case, no suffix). Variants do not match |
| 7   | Size cap threshold              | Section text ≤ 10000 chars (the documented additionalContext cap) → inject; > 10000 → stub     |
| 8   | Empty section vs absent section | Same outcome: no injection. Heading-only with blank body is treated as no contracts            |

## Behavioral dimensions

| Dimension                                              | Partitions                                                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Hook event firing the injection                        | `UserPromptSubmit` (every turn) / `SessionStart:compact` (post-compaction) / other matchers (no-op)                   |
| Sub-ticket `epic:` field state                         | valid (points to existing epic) / missing-file (epic id resolves to nothing on disk) / malformed value / absent field |
| `## Contracts` heading match                           | strict match `## Contracts` / `### Contracts` / `## contracts` / `## Contracts (v2)` / no `Contracts` heading at all  |
| `## Contracts` section body                            | non-empty under cap / non-empty exactly at cap / non-empty over cap / empty (heading-only with blank body)            |
| Epic file mutation between turns                       | unchanged / edited between two UserPromptSubmit events                                                                |
| Ticket type at activeTicket transition                 | non-epic (eligible for replan) / `type: epic` (filtered upstream)                                                     |
| Commits since `last_modified`                          | 0 / ≥1                                                                                                                |
| Replan sub-agent outcome                               | returns report (still-good / change-scope / cancel / split / merge) / fails or times out                              |
| Replan sub-agent invocation                            | `isolation: worktree` set / not set (regression guard)                                                                |
| Invalidation + siblings preconditions for cascade hint | invalidation found + ≥1 sibling sub-ticket in epic / invalidation + no siblings / no invalidation                     |
| User response to replan proposal                       | no action / explicitly accepts / explicitly rejects                                                                   |
| Verify soft-prompt eligibility                         | sub-ticket has `epic:` field / does not have `epic:` field                                                            |
| additionalContext payload count                        | exactly one injection block per turn (#14281 regression guard)                                                        |

## Boundary cases

- `## Contracts` section exactly 10000 chars → inject full section (cap is inclusive on `≤`)
- `## Contracts` section exactly 10001 chars → stub fires
- Empty section body under a present `## Contracts` heading → no-op (same as absent heading)
- Sub-ticket created with `epic: <id>` whose epic file is later deleted mid-session → next UserPromptSubmit emits stderr warning, no crash
- Epic file mutated between two consecutive UserPromptSubmit events → second injection reflects new content (disk-resident truth, no caching)
- Replan triggered with 0 commits since `last_modified` (e.g., resumed mid-turn) → no replan fires
- Replan sub-agent times out at boundary (e.g., 60s budget exceeded) → silent fallback + stderr; `last_modified` still updates so the next resume doesn't re-debate the same commits
- Heading match against `## Contracts` (trailing space) → does NOT match (strict literal)
- Pair-parity test fails (templates/ diverged from .safeword/hooks/) → CI release gate blocks before merge

## Rule mapping

- Hook event × Sub-ticket `epic:` field → **Rule 1: Epic anchor injects on `UserPromptSubmit` when sub-ticket has `epic:` field**
- Hook event (compact matcher) → **Rule 2: Epic anchor re-injects on `SessionStart:compact`**
- Sub-ticket `epic:` field state (missing/malformed) → **Rule 3: Epic file resolution and graceful failure modes**
- Heading match × Section body × Size cap → **Rule 4: Section parsing, size cap, and stub fallback**
- Epic file mutation → **Rule 5: Disk-resident truth — re-read on every injection**
- Ticket type × Commits since `last_modified` → **Rule 6: Replan-on-resume trigger gating**
- Replan sub-agent invocation × outcome (including failure) → **Rule 7: Replan runs in an isolated sub-agent with safe failure modes**
- User response → **Rule 8: Replan output safety — ticket files unchanged without explicit approval**
- `last_modified` update timing → **Rule 9: `last_modified` updates once at replan-complete**
- Invalidation + siblings → **Rule 10: Cascade hint conditioning**
- Verify soft-prompt eligibility → **Rule 11: Verify-skill soft-prompt for cross-ticket contract promotion**
- additionalContext payload count → **Rule 12: Regression guard for #14281 (no double-injection)**

## Why scenarios assert against hook-output rather than model-received view

This is infrastructure: hooks emit JSON or stdout that Claude Code injects. The model's interpretation of that payload is non-deterministic, so the testable surface is what we emit, not what the model "sees." All scenarios accordingly assert against:

- Hook stdout / JSON `hookSpecificOutput.additionalContext` strings
- Filesystem state (`last_modified`, ticket file contents)
- Sub-agent invocation arguments (via a wrapper function whose options are inspectable)
- Process output (stderr for warnings)

Test-definitions should not assume "the model honored this" — that's covered by integration tests against full sessions, not unit scenarios.

## Out-of-scope dimensions (explicit per ticket frontmatter)

- Proactive sibling sweep (no auto-debate of N+2, N+3 tickets)
- Auto-detection of cross-ticket interfaces from sibling code (research-grade, not v1)
- Hard-gated contract promotion at verify (soft prompt only)
- Scope-path-aware commit filtering (any commit counts)
- New `kind: contract` ticket subtype (reuse `type: epic`)
- Opt-out frontmatter (no escape hatch)
- Sub-agent-per-sub-ticket architecture (replan investigation only — not whole tickets)
- New slash commands

## Card-ratio self-check

- **Rules:** 12 behavioral + 1 invariants section
- **Target scenarios:** ~30 across the 12 rules
- **Open questions remaining at this phase:** 0 (8 questions resolved above; 4 investigation items deferred to implement phase per ticket body)
