---
name: quality-review
description: Deep code review with web research. Use when double-checking code
  against latest docs, verifying dependency versions, or reviewing security
  concerns. Complements automatic quality hook with ecosystem verification.
allowed-tools: '*'
---

# Quality Reviewing

Deep review with web research to verify against current ecosystem. Complements automatic hook.

**Stakes set depth.** Review as if your verdict is the last gate before this ships — no one re-checks behind you. That standard, not "the hook already looked," sets how hard you research. Before searching, write your review plan: which angles (§2–3) this diff actually needs and the specific question each must answer, then work the list — don't stop at the first finding.

## Invocation log

This skill is required at the done-gate for tickets with **two or more RGR loops** (W610WW) — the whole-ticket review half of the cross-scenario pass. The line below appends a current-run entry to `skill-invocations.log` under the project namespace root (`.project/`, or legacy `.safeword-project/` where that exists) so the done-gate hook can verify /quality-review was actually invoked. Claude Code expands the `!` line automatically and passes `${CLAUDE_SESSION_ID}` when available. The helper also resolves Claude remote-container ids from the runtime environment, and on Cursor and Codex the pre-shell hook (beforeShellExecution / PreToolUse) bridges the session id to the helper — so on all three runtimes the fallback runs without hand-picking an id. Hand-writing review notes cannot produce this gate proof.

!`PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" && bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" quality-review "${CLAUDE_SESSION_ID:-}" || echo "[skill-invocation-log] FAILED - no current-run proof logged"`

If no `[skill-invocation-log] quality-review ✓` line appears above, run this fallback before continuing:

```bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" quality-review "${CLAUDE_SESSION_ID:-}"
```

**If the automatic line or fallback prints `[skill-invocation-log] FAILED`, prints `no run identity`, or still does not print `quality-review ✓`**: a ≥2-loop ticket must fail closed if no real current-session proof can be logged. Do not mark such a ticket done or hand-write review notes as a substitute for the gate proof. Report the failure to the user (most likely cause: inline shell execution was denied, the runtime did not expose a usable run identity, or Bun could not run the installed helper) and ask them to resolve it before re-invoking /quality-review.

Single-loop tickets, patches, and no-ticket reviews may continue after recording that session-scoped proof was unavailable and not required by the gate.

**When to use this skill (not automatic hook):**

- **Explicit web research**: "double check against latest docs", "verify versions", "check security"
- **Deep dive needed**: Performance, architecture, trade-offs beyond automatic hook
- **Pre-change review**: Review before making changes (hook only triggers after)

**Relationship:** Automatic hook does fast check with existing knowledge. This skill does deep dive with web research (2-3 min).

## 1. Detect Phase

If in BDD workflow, read the current ticket from `<namespace-root>/tickets/` and apply phase-appropriate research:

| Phase               | Research Focus                                  |
| ------------------- | ----------------------------------------------- |
| intake              | Similar features in ecosystem, scope patterns   |
| define-behavior     | Testing patterns, BDD research and patterns     |
| scenario-gate       | Scenario quality, BDD coverage patterns         |
| plan-implementation | Architecture patterns, proof plan strategy      |
| implement           | **Library versions, deprecated APIs, security** |
| verify              | Flaky-test & regression patterns, coverage gaps |
| done                | CI/CD patterns, release checklists              |

## 2. Research Angles (Primary Value)

Run each angle that applies — angle _diversity_ is the lever, not search volume: **version-currency** + **CVE/security** (this section), **deprecation** + **primary-source docs** (§3). If the user gave a focus or scope restriction, apply it to **every** angle — don't use it only for the first search.

### Version-currency & security

This is your main differentiator from the automatic hook.

Read the live `Current time:` line from the prompt timestamp hook and use that date as the current prompt timestamp.
Search for: "[library name] latest stable version as of <current prompt timestamp date>"
Search for: "[library name] security vulnerabilities"

**Flag if outdated:**

- Major versions behind -> WARN (e.g., React 17 when 19 is stable)
- Minor versions behind -> NOTE
- Security vulnerabilities -> CRITICAL (upgrade now)
- Using latest -> Confirm

## 3. Verify Documentation — deprecation + primary-source (Primary Value)

Fetch official documentation for libraries in use.

**Look for:**

- Deprecated APIs being used?
- Newer, better patterns available?
- Recent recommendation changes?

## Output Format

```markdown
## Quality Review

**Versions:** [✓/⚠️/❌] [Latest version check]
**Documentation:** [✓/⚠️/❌] [Current docs check]
**Security:** [✓/⚠️/❌] [Vulnerability check]
**No-bloat:** [✓/⚠️/❌] [smallest thing that works, or name the cut]
**Wiring:** [✓/⚠️/❌] [each new entry-point has a real-collaborator test; mocks only the boundary — name it or justify absence]

**Verdict:** [APPROVE / REQUEST CHANGES / NEEDS DISCUSSION]

**Critical issues:** [List or "None"]
**Suggested improvements:** [List or "None"]
**Provenance:** For version/API claims:

- (verified: [source URL or doc title]) — fetched this session
- (training data: may be outdated) — not verified
- (uncertain) — could not verify

**Next:** [concrete action — upgrade X from a.b.c to x.y.z, refactor {file}:{line}, ask team about Z, or proceed to implementation if APPROVE]
```

The `**Next:**` line is required. On APPROVE, name what to do now (proceed, commit, run /verify). On REQUEST CHANGES, name the specific edit and re-review trigger. On NEEDS DISCUSSION, name the question to ask. A verdict that doesn't tell the reader what to do next is incomplete.

### Wiring gate (required)

For each new entry point or command in the diff, confirm a test built from **real collaborators** that mocks only the process boundary (network / fs / clock / subprocess) — and **name it**, or justify its absence. A fully-mocked suite can be green while the real config→module wiring is broken (see `testing/SKILL.md` → Wiring Tests). Internal-seam mocks and `provider: none`-style short circuits do not count as wiring coverage.

### Provenance gate (required)

Severity is bounded by evidence: **a CRITICAL or REQUEST CHANGES verdict must cite a `verified` source fetched this session.** A claim tagged `(training data)` or `(uncertain)` caps at NOTE / a non-blocking suggestion — it can inform, never block. Tag every issue with its provenance inline, and **surface** an unverifiable concern as a NOTE with the gap named ("couldn't verify X"), never silently drop it. Abstention discipline: LLM judges over-state confidence by default, so an unverified blocker is false certainty.

## Loop: review → fix → re-review

Run the review in passes until it comes back clean — not one-and-done, but not an endless loop either (a couple of passes is usually plenty).

Each pass:

1. **Review with a fresh, independent reviewer** — one that doesn't share your
   blind spots. A same-model, same-context reviewer shares them, and ungrounded
   self-correction can _degrade_ code rather than improve it. **Prefer a
   different model of comparable-or-better capability; if you don't have one,
   run a fresh-context pass on your own model** — the usual path, since most
   setups run a single model. Never review on a _weaker_ model: a fresh context
   on your own model beats a weaker different one. Hand the reviewer only the
   diff and the ticket scope, have it apply §1–3, and return the Output Format
   above.
   - Claude Code: Agent/Task tool. Codex: ask in your prompt — subagents never
     auto-spawn, and `/agent` only switches between existing threads. Cursor:
     subagents.
   - No sub-agent? Re-read in a fresh context (a different comparable-or-better
     model if you can switch to one). Independence is the point, not the
     mechanism.
2. **Triage.** Fix every **Critical issue** this pass. Apply the **Suggested
   improvements** worth the change; list the rest — don't chase them.
3. **Decide.** Stop when **Critical issues = None** — remaining suggestions are
   optional, not a reason to loop. Don't loop indefinitely; a couple of passes is
   the practical ceiling. Re-review only if you edited code this pass.

A pass isn't done until `/verify` (tests, lint, typecheck) is green. That
objective signal — not the reviewer running out of suggestions — is the real
stop condition; tests are the ground truth.

**Voice:** plainspoken and concise — write to be scanned.

**Avoid bloat.**
