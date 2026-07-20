# Anthropic `claude-code-plugins` vs. SAFEWORD — Capability Compare & Contrast

_Generated 2026-07-19. Sources: Anthropic marketplace repo `anthropics/claude-code` (13 plugins, read from file contents) and the safeword project surface (v0.69.0, read from `.claude/skills`, `.safeword/`, templates, hooks)._

---

## 0. TL;DR

The two are **different species solving overlapping problems**:

- **Anthropic `claude-code-plugins`** is an **à-la-carte marketplace**: 13 independent, single-purpose plugins you install as you like. Each is a self-contained tool (a command, a few agents, a skill, or a hook). No shared state, no cross-plugin workflow, no enforcement that you _used_ them. Claude-Code-only.
- **SAFEWORD** is an **opinionated operating system**: ~20 skills + 40+ hooks + a CLI + a ticket/artifact model, all wired into a single 5-phase session workflow with **four hard gates** that _block the turn_ until discipline is met. Ships to **three runtimes** (Claude Code, Cursor, Codex) from one parity-enforced template set.

Put simply: **Anthropic gives you sharp tools; safeword gives you a process that refuses to let you skip steps.** Where they overlap (code review, feature dev, testing, git, guardrails), safeword's version is almost always _gated and stateful_ where Anthropic's is _on-demand and stateless_. Anthropic has several things safeword has no counterpart for (frontend design, SDK scaffolding, model migration, output styles, the Ralph loop, plugin-authoring). Safeword has large territory Anthropic doesn't touch (debugging discipline, ticket/context anchoring, retros, spec/scenario gates, release/versioning discipline, auto-lint, architecture drift).

---

## 1. Framing: the axes that matter

| Axis                       | Anthropic marketplace                                       | SAFEWORD                                                                                 |
| -------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Unit**                   | Independent plugin                                          | Integrated phase workflow                                                                |
| **Invocation**             | User runs a command when they want it                       | Skills auto-nudged; gates fire automatically at Stop/PreToolUse                          |
| **Enforcement**            | None — advisory output                                      | 4 hard gates can `block` the turn; proof-of-invocation logs                              |
| **State**                  | Mostly stateless (ralph/security-guidance keep local state) | Heavily stateful: tickets, phases, re-entry briefs, review stamps, session quality state |
| **Memory across sessions** | None                                                        | `re-entry.md`, work logs, learnings, ticket frontmatter survive compaction & restart     |
| **Runtimes**               | Claude Code only                                            | Claude Code + Cursor + Codex, byte-parity enforced                                       |
| **Philosophy**             | Precision tools, minimal ceremony                           | Process discipline, "never mark done without proof"                                      |
| **Model usage**            | Explicit Haiku/Sonnet/Opus ladders per task                 | Cross-model review (different model as independent reviewer)                             |

---

## 2. Head-to-head by capability area

Each section: **what Anthropic ships → safeword's counterpart → compare/contrast → verdict.**

### 2.1 Code review & PR quality

**Anthropic — `code-review` + `pr-review-toolkit` + `feature-dev`'s reviewer**

- `code-review`: a `/code-review` command orchestrating a **Haiku→Sonnet→Opus ladder**: Haiku triage/gate, Sonnet CLAUDE.md-compliance auditors, Opus bug/security hunters, then a **separate independent validation subagent** confirms each finding before it's reported. Precision-first: _"we only want HIGH SIGNAL issues,"_ posts one inline GitHub comment per confirmed issue.
- `pr-review-toolkit`: **six specialist agents, one concern each** — `code-reviewer` (0–100 confidence, report ≥80), `silent-failure-hunter` (zero-tolerance error-handling auditor), `pr-test-analyzer` (behavioral coverage, 1–10 per test), `type-design-analyzer` (4-axis: encapsulation/invariant expression/usefulness/enforcement), `comment-analyzer` (comment-rot, advisory-only), `code-simplifier` (rewrites recently-changed code). Run via `/review-pr [aspects]`, aggregated to Critical/Important/Suggestions.

**SAFEWORD — `quality-review` skill + `stop-quality.ts` hook + `code-review`/`review` commands**

- **Automatic**: `post-tool-quality.ts` + `stop-quality.ts` run a **phase-aware auto quality review at every turn-end**, no command needed; it can `decision:"block"` to demand review before you stop.
- **Deep**: the `quality-review` skill does review with **live web research**, enforces a **provenance gate** (a CRITICAL verdict must cite a `verified` source fetched _this session_; training-data claims cap at NOTE) and a **wiring gate** (every new entry point needs a real-collaborator test). Runs a review→fix→re-review loop with a **fresh, no-weaker, preferably different-model** reviewer until Critical=None and `/verify` is green.

**Compare/contrast:**

- **Structure of trust**: Anthropic's `code-review` earns signal via a _validation subagent stage_; safeword earns it via a _provenance gate_ (must cite a live-fetched source) + _cross-model reviewer_. Different mechanisms, same goal (kill false positives).
- **Specialization**: pr-review-toolkit's six-agent split (esp. `type-design-analyzer` and `silent-failure-hunter`) is **more granular than anything safeword ships as discrete agents** — safeword folds error-handling/type concerns into one holistic review + the `testing` iron laws, rather than dedicated specialist agents with per-axis rubrics.
- **Automation**: safeword reviews **whether you ask or not** (Stop hook) and can block; Anthropic reviews **only when you run the command**.
- **Confidence models**: Anthropic exposes explicit numeric thresholds (≥80); safeword uses gates + verdict tiers (Critical/Request-changes/Note) instead of a score.

**Verdict:** Anthropic wins on **specialist granularity + explicit scoring**; safeword wins on **automatic enforcement, provenance rigor, cross-model independence**. _Complementary — pr-review-toolkit's type/error/simplify agents would be a genuine add on top of safeword's gate._

---

### 2.2 Feature development workflow

**Anthropic — `feature-dev`**: 7-phase `/feature-dev` with human approval gates: Discovery → **fan out 2-3 `code-explorer` agents** → Clarifying Questions ("DO NOT SKIP") → **fan out 2-3 `code-architect` agents** with different biases (minimal/clean/pragmatic), user picks → Implementation ("DO NOT START WITHOUT USER APPROVAL") → **3 `code-reviewer` agents** → Summary. Breadth via parallel agents; orchestrator reads flagged files for depth.

**SAFEWORD — `bdd` skill + the whole 5-phase model**: behavior-first: `intake → define-behavior → scenario-gate → plan-implementation → implement → verify → done`, tracked in **ticket frontmatter** with a **phase file per stage** and **hard phase-exit reviews** (scenario-gate requires an independent Tier-2 fork review, cross-model when enabled). Preceded by the standing Clarify workflow (**Frame → Design-the-ideal via `/figure-it-out` → Survey existing → Reconcile**) and Classify (patch/task/feature sizing).

**Compare/contrast:**

- **Both** fan out parallel agents for exploration/architecture and both insist on clarifying-before-coding. `feature-dev`'s three-architect-with-different-biases trick is elegant and safeword has an analogue in `figure-it-out` (2-3 options, steelman the disfavored one).
- **Artifacts & memory**: safeword produces durable artifacts (`spec.md`, `.feature`, `test-definitions.md`, `impl-plan.md`, `verify.md`) tied to a ticket that survives across sessions; `feature-dev` is a **single-session guided flow with no persistent ticket/artifact trail**.
- **Enforcement**: `feature-dev`'s gates are _prompt instructions_ ("DO NOT START WITHOUT USER APPROVAL") the model can in principle skip; safeword's phase/plan gates are _hook-enforced_ — you literally cannot enter `implement` without a valid `impl-plan.md`, or mark done without `verify.md`.
- **Behavior-first**: safeword is scenario/BDD-driven (write `.feature` + failing scenarios first); `feature-dev` is architecture-first and doesn't mandate tests-first.

**Verdict:** Same instincts, opposite rigidity. `feature-dev` is **lighter-weight and self-contained**; safeword's `bdd` is **heavier, artifact-driven, and enforced**. For a quick feature `feature-dev` is faster; for auditable multi-session work safeword's trail wins.

---

### 2.3 Testing

**Anthropic**: no standalone testing plugin. Test concern lives inside `pr-review-toolkit`'s `pr-test-analyzer` (behavioral coverage, rates each suggested test 1–10 by the regression it prevents, values DAMP tests, flags implementation-coupling) and `silent-failure-hunter`.

**SAFEWORD**: `testing` skill (non-invocable knowledge base used by bdd/tdd-review/refactor/debug) — **Five Iron Laws** (behavior not implementation; meaningful assertion; must-fail-first; one-behavior-per-test; independence), an anti-pattern table (coverage theater, mock-everything, bug-locking…), LLM-eval guidance (grade outcomes, binary PASS/FAIL), and **wiring tests** (mock only the process boundary). Plus `tdd-review` (RED/GREEN/REFACTOR step-aware checks incl. a vacuity guard: the test must fail _now for the right reason_, confirmed by running it) and the phase gate requiring `test-definitions.md`.

**Compare/contrast:** Anthropic's `pr-test-analyzer` and safeword's `testing`/`tdd-review` share the exact same doctrine — _test behavior not implementation, tests should fail when behavior changes not when implementation does._ Difference is packaging: Anthropic = **one review agent** that grades existing tests; safeword = **a doctrine + a TDD-cycle enforcer + a hard gate** woven through the whole feature flow.

**Verdict:** Strong philosophical overlap. Safeword is more prescriptive and enforced (tests-first is gated); Anthropic is review-time advisory. `pr-test-analyzer`'s explicit 1–10 per-test criticality rating is a nice artifact safeword doesn't render.

---

### 2.4 Debugging

**Anthropic**: **nothing.** No debugging plugin.

**SAFEWORD — `debug` skill**: investigate-first, "symptom fixes are declared failure." Four phases: Root-Cause Investigation (read errors fully, reproduce, `git bisect run`/delta-debugging, trace to source), Pattern Analysis, Hypothesis Testing (**2-3 competing hypotheses, cheapest disconfirming check first, one change at a time**), Implementation (failing test → fix root cause only). Documents ruled-out hypotheses in the ticket; escalates to questioning architecture after 3+ failed fixes.

**Verdict:** **Pure safeword advantage — no Anthropic counterpart.** This is one of safeword's most distinctive skills.

---

### 2.5 Git / commit workflow

**Anthropic — `commit-commands`**: `/commit` (single commit, least-privilege tools, all-in-one-message), `/commit-push-pr` (branch→commit→push→`gh pr create`), `/clean_gone` (delete branches whose remote is `[gone]`, remove worktrees). Deterministic, single-turn, driven by pre-injected `git` output.

**SAFEWORD**: no dedicated commit command, but **git is enforced via hooks**: `pre-tool-architecture-stage.ts` regenerates & stages stale `architecture.generated.md` into the in-flight commit, `pre-tool-stale-main.ts` warns before switching to a behind branch, the **LOC gate** forces a commit every ~400 lines, and `pre-tool-git-bare-fix.sh`. The commit _message/PR_ mechanics safeword leaves to the harness.

**Compare/contrast:** Anthropic gives you clean **explicit commit/PR commands**; safeword gives you **implicit commit hygiene enforcement** (commit cadence, arch-doc staging) but no "make the commit + PR for me" command.

**Verdict:** Anthropic's `commit-commands` is a **genuine gap-filler for safeword** — the two don't conflict; safeword enforces _when/how often_ to commit, Anthropic automates the _act_. `clean_gone` in particular has no safeword equivalent.

---

### 2.6 Frontend / visual design

**Anthropic — `frontend-design`** (skill): anti-templating design doctrine. Frames you as a studio design lead whose client "rejected proposals that felt templated"; names the **three AI-default clusters to avoid** (cream+serif+terracotta; near-black+acid accent; broadsheet hairline newspaper); prescribes ground-in-the-subject choices, a compact token system, and "critique again" self-review; treats copy as design material.

**SAFEWORD**: **nothing comparable.** Safeword has `dataviz`-adjacent nothing here; design is out of its scope entirely. (Note: the _session_ has a separate Anthropic `dataviz`/`artifact-design` skill, but that's not safeword.)

**Verdict:** **Pure Anthropic advantage.** If frontend/visual quality matters, `frontend-design` has no safeword answer.

---

### 2.7 Hooks & guardrails

**Anthropic — `hookify` + `security-guidance`**

- `hookify`: democratizes hook creation via a **markdown-DSL** (`.claude/hookify.*.local.md` rule files, regex/condition matching, warn|block), a `conversation-analyzer` agent that mines your transcript for **frustration signals** and proposes rules, and `/hookify /list /configure` management commands. Rules active immediately, no restart.
- `security-guidance`: **three-layer defense-in-depth** — (1) ~25 fast regex PostToolUse pattern warnings, (2) a **Stop-hook LLM diff review** scoped to _only this session's changes_ via a `git stash create` baseline, exit-2 to force fixes before the user sees the response, (3) an **agentic cross-file commit reviewer** (read-only Read/Grep/Glob, traces data flow across files for IDOR/auth-bypass/SSRF, recall-first with downstream adjudication). ~12 Python modules, rate limits, kill switches, org policy files.

**SAFEWORD — the entire hook system (40+ hooks, 4 hard gates)**: SessionStart (context injection, auto-upgrade, arch-heal, dependency readiness), UserPromptSubmit (propose-and-converge nudges, timestamp), Stop (auto quality review that can block, re-entry brief, auto-retro, retro-filing gate), PreToolUse (LOC gate ~400 lines, phase/plan gates, config guard requiring approval, blocked-on gate), PostToolUse (**auto-lint changed files**, bypass-warn on `@ts-ignore`/eslint-disable, skill-nudge, learning-index sync, work-log append). Parallel implementations for Cursor and Codex.

**Compare/contrast:**

- **hookify vs safeword hooks**: opposite directions. `hookify` is a **meta-tool to let _users author their own_ ad-hoc guardrails** from a DSL; safeword ships a **large fixed set of opinionated guardrails** you don't write. hookify's `conversation-analyzer` (mine frustration → propose a rule) is a clever pattern safeword has no analogue for — safeword's equivalent learning loop is the **retro** (mine transcript → file friction upstream), but that files _product feedback_, not _session guardrails_.
- **security-guidance vs safeword**: this is the closest Anthropic gets to safeword's philosophy — **automatic, session-scoped-diff, blocks-until-fixed, feeds findings back into the loop.** security-guidance is arguably **deeper on security specifically** (cross-file taint tracing, a whole vuln taxonomy, baseline-diff engineering) than safeword's general `quality-review`. Safeword has a `security-review` command surface but its automatic Stop-gate is _general quality_, not a dedicated agentic security tracer.

**Verdict:** `hookify` = a capability safeword doesn't offer (user-authored DSL guardrails). `security-guidance` = **the one Anthropic plugin that rivals safeword's enforcement rigor**, and is _more specialized on security_ than safeword's general gate. Both are strong candidates to run _alongside_ safeword.

---

### 2.8 Output styles (teaching modes)

**Anthropic — `explanatory-output-style` + `learning-output-style`**: SessionStart prompt-injection plugins. `explanatory` emits `★ Insight` educational blocks (codebase-specific, as you code). `learning` hands the user the **decisions with real trade-offs** — scaffolds file+signature+`TODO`, asks the user to write 5-10 meaningful lines.

**SAFEWORD — `explain` skill** (adjacent, not identical): translates safeword's dense artifacts/state/gate-blocks into **plain English** ("catch me up," or "why did this gate fire and how do I clear it"). Read-only. Also the whole "Talking to the user" style contract in SAFEWORD.md (lead with the answer, gloss jargon, `**Next:**` line).

**Compare/contrast:** Different intent. Anthropic's output styles are **pedagogical modes** (teach the user, or make them co-author). Safeword's `explain` is a **de-jargonizer for its own machinery**, not a teaching mode. There's no safeword equivalent to `learning-output-style`'s "make the human write the load-bearing 10 lines."

**Verdict:** **Anthropic advantage** for teaching/pairing modes. Safeword's `explain` solves a different (safeword-specific) problem.

---

### 2.9 Iterative self-loop

**Anthropic — `ralph-wiggum`**: the "Ralph" technique — a Stop-hook loop that **re-feeds the same prompt** until the model emits an exact-match `<promise>` completion string (or hits `--max-iterations`). "You may ONLY output the promise when it is completely and unequivocally TRUE." Good for well-defined verifiable greenfield tasks.

**SAFEWORD**: no direct equivalent. The nearest relatives are the **quality-review review→fix→re-review loop** and the **Stop gates that block until artifacts exist** — but those loop toward a _gate condition_, not by re-injecting a user prompt N times. Safeword also has "replan on resume" (spawns a worktree sub-agent to judge stale plans).

**Verdict:** **Anthropic advantage** — the generic "keep hammering the same task until a truthful completion promise" loop is not something safeword ships. (Safeword's loops are gate-driven, not prompt-repeat-driven.)

---

### 2.10 Plugin / SDK authoring

**Anthropic — `plugin-dev` + `agent-sdk-dev`**

- `plugin-dev`: a **meta-plugin** — `/create-plugin` 8-phase workflow, agents (`agent-creator`, `plugin-validator`, `skill-reviewer`), and **8 knowledge skills** (plugin-structure, skill-development, command-development, agent-development, hook-development, mcp-integration, plugin-settings). Encodes triggering/progressive-disclosure/description-quality as first-class metrics.
- `agent-sdk-dev`: `/new-sdk-app` docs-first scaffolder (WebFetch official docs + latest versions before writing), plus TS/Py verifier agents (PASS/FAIL on SDK-correctness, ignore style).

**SAFEWORD**: partial overlap via `skill-creator` (a _session_ Anthropic skill, not safeword) and safeword's own **`versioning` + `parity-check` + release discipline** for authoring/maintaining safeword itself. But safeword has **no general "build me a plugin/agent/skill" authoring toolkit** and **no SDK scaffolder**.

**Compare/contrast:** `plugin-dev`'s `skill-reviewer` (description-quality-first, third-person triggers, 1,000–3,000-word lean SKILL.md, imperative style) is essentially **the rubric safeword's own skills follow** — safeword _embodies_ those conventions but doesn't ship a tool to _teach/enforce_ them to others. `agent-sdk-dev`'s "WebFetch latest docs before writing, verify before done" mirrors safeword's "authority: docs not memory" + `verify` gate — same values, different domain (SDK apps vs project work).

**Verdict:** **Anthropic advantage** for building _new_ plugins/agents/SDK apps. Safeword is the _consumer_ side of these conventions, not a _generator_.

---

### 2.11 Model migration

**Anthropic — `claude-opus-4-5-migration`**: swap model strings across platforms, remove the unsupported 1M-context beta header, add `effort:"high"`, and _optionally_ soften over-aggressive prompt language ("CRITICAL/You MUST/ALWAYS/NEVER" now cause overtriggering on Opus 4.5) — opt-in per reported symptom. Behavior-aware, reversible, minimal.

**SAFEWORD**: **nothing** — model migration is out of scope. (Safeword _does_ persist `SAFEWORD_AUTHOR_MODEL` and do cross-model review, but never migrates model strings.)

**Verdict:** **Pure Anthropic advantage**, though narrow/one-time in nature.

---

## 3. What SAFEWORD has with NO Anthropic counterpart

These are safeword capabilities the marketplace simply doesn't address:

1. **Debugging discipline** (`debug`) — investigate-first, competing-hypotheses, bisect.
2. **Ticket / context-anchoring system** (`ticket-system`) — CLI-minted Crockford-ID tickets, phase tracking, work logs, artifact levels (epic/feature/task/patch), "never mark done without user confirmation."
3. **Cross-session memory** — `re-entry.md` briefs, learnings with an INDEX, ticket frontmatter that survives compaction/restart. The marketplace is entirely single-session.
4. **Spec & scenario quality gates** — `self-review` (spec Tier-1, stamp-bound), `review-spec` (adversarial scenario review: vacuous-pass, AODI, negative-case, wiring).
5. **The `verify` done-gate** — a rigid checklist whose literal phrases a hook validates; blocks "done" until green (tests/build/typecheck/deps/bdd + PR-scope guard).
6. **Retrospectives** (`retro` + auto-retro Stop hook + `safeword-retro-filer` subagent) — mine the transcript for friction, sanitize behind an egress guard, file upstream. A **self-improvement feedback loop** the marketplace has no analogue for.
7. **Auto-lint on every edit** (`post-tool-lint.ts`) + `lint` skill across Python/JS/TS/Go.
8. **Architecture drift management** — `architecture.generated.md` heal/stage/`--check`, ADR promotion, cross-model architecture review.
9. **Refactor discipline** (`refactor`) — Mikado-ordered leaf-first ledger, mutation-never-fans-out, characterization tests, revert-on-fail.
10. **Codebase health audit** (`audit`) — dead code, cycles, duplication, dep-drift risk matrix, config-drift, agent-config staleness, across 4 language ecosystems.
11. **Release/versioning contract** (`versioning`) — strict semver as an _auto-upgrade contract_ (patch+minor silent, major notifies), four release-tracked manifests kept in lockstep, OIDC trusted publish.
12. **Zombie-process cleanup** (`cleanup-zombies`) — project-scoped dev-server/test-runner killing.
13. **Elicitation & brainstorming** (`elicit`, `brainstorm`) — tacit-knowledge microquestions; divergence-first ideation.
14. **Three-runtime parity** — the same discipline in Claude Code, Cursor, and Codex from one canonical, parity-checked source.
15. **The 5-phase operating model itself** — Clarify(propose-and-converge)/Classify/Build/Verify/Done with load-bearing research ordering.

---

## 4. What Anthropic has with NO (or weak) SAFEWORD counterpart

Opportunities safeword could borrow or run alongside:

1. **Frontend/visual design doctrine** (`frontend-design`) — safeword has zero design coverage.
2. **Specialist review agents with per-axis rubrics** — `type-design-analyzer` (4-axis), `silent-failure-hunter` (zero-tolerance error auditing), `code-simplifier`. Safeword's review is holistic; these are sharper on their axis.
3. **Explicit commit/PR commands** (`commit-commands`, esp. `clean_gone`) — safeword enforces commit cadence but doesn't ship the "make the commit/PR/cleanup" action.
4. **User-authored guardrail DSL** (`hookify`) — safeword's guardrails are fixed; hookify lets a user mint their own from a markdown rule + transcript mining.
5. **Dedicated agentic security tracer** (`security-guidance`) — cross-file taint tracing + vuln taxonomy; deeper on security than safeword's general Stop-gate.
6. **Teaching / pairing output modes** (`explanatory`, `learning`) — no safeword equivalent to "hand the human the load-bearing decisions."
7. **Generic iterate-until-true loop** (`ralph-wiggum`).
8. **Plugin/agent/skill authoring toolkit** (`plugin-dev`) + **SDK scaffolder** (`agent-sdk-dev`).
9. **Model-migration helper** (`claude-opus-4-5-migration`).
10. **Explicit model ladders** — `code-review` deliberately assigns Haiku/Sonnet/Opus by task difficulty; safeword leans on cross-model _review_ but is less explicit about a cost-tiered ladder for sub-tasks.

---

## 5. Philosophy & architecture contrasts

| Dimension               | Anthropic marketplace                                                                                                                          | SAFEWORD                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Precision vs recall** | Mostly precision-first (`code-review` "high signal only," ≥80 confidence). `security-guidance` is the exception (recall-first + adjudication). | Precision via gates + provenance; cross-model independence to filter.                     |
| **Enforcement locus**   | Prompt instructions + a few Stop-hook loops (ralph, security-guidance).                                                                        | Hook-enforced hard gates that `block` the turn; proof-of-invocation logs.                 |
| **How trust is earned** | Separate _validation subagent_ stage (code-review); numeric confidence.                                                                        | _Provenance gate_ (cite a live-fetched source), _cross-model reviewer_, verdict tiers.    |
| **Human-in-the-loop**   | Ranges from gate-heavy (feature-dev, plugin-dev) to fully autonomous (ralph, commit).                                                          | Propose-and-converge clarify phase; user must confirm "done"; gates otherwise autonomous. |
| **State & memory**      | Local per-plugin state at most; no cross-session memory.                                                                                       | Tickets, phases, re-entry, learnings, review stamps, session quality state.               |
| **Learning loop**       | `hookify` mines frustration → guardrail (user-local).                                                                                          | `retro` mines friction → files upstream (product feedback).                               |
| **Scope of concern**    | Coding tasks (review, feature, git, design, security, authoring).                                                                              | Whole SDLC discipline incl. tickets, specs, verify, release, architecture, retros.        |
| **Runtime reach**       | Claude Code only.                                                                                                                              | Claude Code + Cursor + Codex, parity-enforced.                                            |
| **Composability**       | High — install any subset independently.                                                                                                       | Low — it's one integrated system (that's the point).                                      |

---

## 6. Bottom line & recommendations

- **They are complementary, not competing.** Safeword is the _process spine_; the Anthropic plugins are _sharp point-tools_. Nothing stops you running specific Anthropic plugins _inside_ a safeword project.
- **Highest-value Anthropic plugins to run alongside safeword:**
  1. `pr-review-toolkit` — its `type-design-analyzer`, `silent-failure-hunter`, and `code-simplifier` agents add axes safeword's holistic review doesn't isolate.
  2. `security-guidance` — a dedicated agentic security tracer that safeword's general gate doesn't match on security depth.
  3. `frontend-design` — fills a total gap if any UI work is in scope.
  4. `commit-commands` — `clean_gone` and one-shot commit/PR have no safeword equivalent.
- **Where safeword clearly leads:** debugging, tickets/memory, spec/scenario gates, verify/done-gate, retros, refactor/audit discipline, release/versioning, auto-lint, architecture drift, and multi-runtime reach. The marketplace has no answer to any of these.
- **Conceptual convergences worth noting** (same values, different packaging): "docs not memory" (safeword) ≈ "WebFetch latest docs before writing" (`agent-sdk-dev`); test-behavior-not-implementation (`testing`/`tdd-review`) ≈ `pr-test-analyzer`; independent validation (safeword cross-model) ≈ `code-review`'s validation subagent; session-scoped-diff-blocks-until-fixed (`security-guidance`) ≈ safeword's Stop quality gate.
- **If safeword wanted to grow**, the cleanest borrows are: (a) discrete specialist review agents with per-axis rubrics, (b) a `hookify`-style user-authored guardrail DSL, (c) explicit cost-tiered model ladders for sub-tasks, and (d) a design skill.

---

## 7. Action candidates for safeword

Two kinds of follow-up: **net-new gaps to borrow** (capabilities we lack) and **overlap to sharpen** (things we already have where Anthropic's version carries a mechanic worth adopting). Prioritized.

### 7a. Gaps worth borrowing (net-new capability)

| # | Borrow | From | Value | Effort |
|---|---|---|---|---|
| G1 | Explicit commit/PR/cleanup commands — esp. `clean_gone` (delete `[gone]` branches + worktrees), one-shot commit→push→PR | `commit-commands` | Fills an action safeword has no equivalent for; complements our commit-cadence enforcement | Low |
| G2 | Discrete specialist review agents with per-axis rubrics — `type-design-analyzer` (4-axis), `silent-failure-hunter` (error-handling), `code-simplifier` | `pr-review-toolkit` | Adds review axes our holistic pass doesn't isolate | Med |
| G3 | User-authored guardrail DSL — markdown rule files + transcript-mining to propose rules | `hookify` | Lets a project mint its own guardrails; we only ship fixed ones | Med |
| G4 | Dedicated agentic security tracer — cross-file taint tracing + vuln taxonomy | `security-guidance` | Deeper on security than our general Stop-gate | High |
| G5 | Frontend/visual design skill — anti-templating, subject-derived design doctrine | `frontend-design` | Total gap; only matters if UI work is in scope | Med |
| G6 | Teaching/pairing output modes — hand the human the load-bearing decisions | `learning-output-style` | No safeword equivalent; optional pedagogy mode | Low |

_Lower priority / narrow: plugin-authoring toolkit (`plugin-dev`), SDK scaffolder (`agent-sdk-dev`), model-migration helper, the Ralph iterate-until-true loop._

### 7b. Overlap to sharpen (we have a counterpart; borrow the mechanic)

| # | Sharpen | Our asset | Borrow the mechanic from | Value | Effort | Rec |
|---|---|---|---|---|---|---|
| S1 | Scope the auto Stop-review to **only this session's diff** via a `git stash create` baseline SHA that advances each turn | `stop-quality.ts` | `security-guidance` layer 2 | Kills "complaining about code I didn't touch" noise; cheaper review | Low–Med | **Pursue** |
| S2 | Render each scenario/test with **the specific regression it prevents** ("what breaks if deleted?") | `testing` / `test-definitions` | `pr-test-analyzer` | Directly lifts scenario quality; fits our existing doctrine | Low | **Pursue** |
| S3 | Explicit **cheap-triage-first model ladder** (skip trivial diffs) + a distinct **validate-then-filter** stage before reporting findings | `quality-review` / `stop-quality` cross-model review | `code-review` | Better cost/signal on the Stop-gate | Med | Consider |
| S4 | **Biased-parallel option generation** — fan out 2-3 sub-agents with different biases (minimal/clean/pragmatic), user picks | `figure-it-out` | `feature-dev` | Genuine independence for one-way-door decisions | Med | Consider (big decisions only) |
| S5 | **Escalating-cost review tiers** (regex → single-shot LLM → agentic cross-file) for depth-on-demand | single-tier quality gate | `security-guidance` 3-layer | Depth only where warranted | High | Later |

**Recommendation:** pursue **S1 and S2** first (high value, low risk, no philosophy change), plus **G1** (cheap, clear gap). Everything else is "consider," gated on appetite.

---

_End of comparison._
