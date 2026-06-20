---
name: quality-review
description: Deep code review with web research. Use when double-checking code
  against latest docs, verifying dependency versions, or reviewing security
  concerns. Complements automatic quality hook with ecosystem verification.
allowed-tools: '*'
---

# Quality Reviewing

Deep review with web research to verify against current ecosystem. Complements automatic hook.

**When to use this skill (not automatic hook):**

- **Explicit web research**: "double check against latest docs", "verify versions", "check security"
- **Deep dive needed**: Performance, architecture, trade-offs beyond automatic hook
- **Pre-change review**: Review before making changes (hook only triggers after)

**Relationship:** Automatic hook does fast check with existing knowledge. This skill does deep dive with web research (2-3 min).

## 1. Detect Phase

If in BDD workflow, read the current ticket from `<namespace-root>/tickets/` and apply phase-appropriate research:

| Phase           | Research Focus                                  |
| --------------- | ----------------------------------------------- |
| intake          | Similar features in ecosystem, scope patterns   |
| define-behavior | Testing patterns, BDD research and patterns     |
| scenario-gate   | Architecture patterns, test layer strategy      |
| implement       | **Library versions, deprecated APIs, security** |
| verify          | Flaky-test & regression patterns, coverage gaps |
| done            | CI/CD patterns, release checklists              |

## 2. Research Angles (Primary Value)

Run each angle that applies — angle _diversity_ is the lever, not search volume: **version-currency** + **CVE/security** (this section), **deprecation** + **primary-source docs** (§3). If the user gave a focus or scope restriction, apply it to **every** angle — don't use it only for the first search.

### Version-currency & security

**CRITICAL**: This is your main differentiator from automatic hook.

Read the live `Current time:` line from the prompt timestamp hook and use that date as the current prompt timestamp.
Search for: "[library name] latest stable version as of <current prompt timestamp date>"
Search for: "[library name] security vulnerabilities"

**Flag if outdated:**

- Major versions behind -> WARN (e.g., React 17 when 19 is stable)
- Minor versions behind -> NOTE
- Security vulnerabilities -> CRITICAL (must upgrade)
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

### Provenance gate (required)

Severity is bounded by evidence: **a CRITICAL or REQUEST CHANGES verdict must cite a `verified` source fetched this session.** A claim tagged `(training data)` or `(uncertain)` caps at NOTE / a non-blocking suggestion — it can inform, never block. Tag every issue with its provenance inline, and **surface** an unverifiable concern as a NOTE with the gap named ("couldn't verify X"), never silently drop it. Abstention discipline: LLM judges over-state confidence by default, so an unverified blocker is false certainty.

## Loop: review → fix → re-review

Run the review in passes (MAX_PASSES = 3), not one-and-done.

Each pass:

1. **Review with a fresh, independent reviewer.** Independence is what catches
   bugs: a same-model, same-context reviewer shares your blind spots, and
   ungrounded self-correction can _degrade_ code rather than improve it. A
   different equal-tier model already pays off (verifying is easier than
   generating) — but that edge collapses on the subtle, hard-to-verify bugs you
   most need caught, so never review on a model _below your tier_ (capability
   class — e.g. frontier vs mid vs small). Spawn the reviewer in this order:
   (1) a different model at or above your tier; (2) failing that, a fresh-context
   pass on your own model; (3) a weaker different model only as a last resort.
   Hand it only the diff and the ticket scope, have it apply §1–3, and return the
   Output Format above.
   - Claude Code: Agent/Task tool. Codex: ask in your prompt — subagents never
     auto-spawn, and `/agent` only switches between existing threads. Cursor:
     subagents.
   - No sub-agent available? Apply the same order by hand — switch to a different
     at-or-above-tier model if you can, else re-read in fresh context on your own
     model. Independence is the point, not the mechanism.
2. **Triage.** Fix every **Critical issue** this pass. Apply the **Suggested
   improvements** worth the change; list the rest — don't chase them.
3. **Decide.** Stop when **Critical issues = None** — remaining suggestions are
   optional, not a reason to loop. Cap at MAX_PASSES regardless. Re-review only
   if you edited code this pass.

A pass isn't done until `/verify` (tests, lint, typecheck) is green. That
objective signal — not the reviewer running out of suggestions — is the real
stop condition; tests are the ground truth.

## Reminders

1. **Primary value: Web research** - Verify versions, docs, security
2. **Complement automatic hook** - Hook prompts for the decision-brief verdict and per-phase evidence; you verify versions, primary-literature claims, and ecosystem context the hook can't see
3. **Phase matters** - Adapt research focus to current BDD phase
4. **Be concise** - Hook already prompts for general quality, focus on what it can't do

**Voice:** plainspoken and concise — write to be scanned.
