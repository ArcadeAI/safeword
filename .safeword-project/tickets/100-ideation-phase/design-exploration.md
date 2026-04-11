# Ticket #100 — Design Exploration Log

Record of approaches explored, debated, and evaluated during the propose-and-converge design process.

## Phase 1: The Original Problem (2026-04-10)

**Customer feedback from Guru:** Safeword jumps straight to technical scoping questions (runtime, architecture, output format), assuming the user is set on the idea. He wanted help refining the idea itself first.

**Two examples from the same user:**

- Vague: "I want to build a Habtab that tells me what to focus on" → wanted ideation, got technical questions
- Specific with hidden decisions: "bring up a webhook via ngrok that stops tool calls for cate" → also wanted ideation on the underlying problem

---

## Phase 2: Ideation Approaches (2026-04-10)

### Approach A: Smart detection (vague vs clear)

Detect vague requests → ideate. Detect clear requests → skip ideation.

**Rejected:** Guru's ngrok example broke it — request sounded clear but had hidden decisions. Detection is hard; false negatives skip ideation when it's most valuable (XY problem).

### Approach B: Always-why

Every request gets a "why" pass before technical scoping.

**Rejected:** Research strongly against. Users who know what they want find it patronizing. #1 frustration with AI assistants is unnecessary clarification questions.

### Approach C: Contribute-then-probe (thought partner)

Don't front-load questions. Restate what you heard, contribute a perspective, surface open questions as part of the contribution.

**Selected.** Most natural. Works across the entire clarity spectrum. No mode detection needed.

---

## Phase 3: Stopping Condition Models (2026-04-11)

How does the agent know when to stop exploring and start building?

### Model 1: Decision-counting

Track open/resolved questions. Stop when all questions are resolved.

**Rejected:** Useful bookkeeping but terrible UX. People don't think in schemas. Produces interrogation.

### Model 2: User signal detection

Detect linguistic shifts from wondering ("what if...") to directing ("let's do X").

**Kept as secondary signal.** Necessary but insufficient — some users never explicitly shift.

### Model 3: Propose-and-converge (contribution ratio)

Each turn: contribute more than you extract. Make proposals with increasing specificity. Stop when user accepts a proposal.

**Selected.** Matches pair programming (Clark & Schaefer grounding theory). Self-regulating depth. Convergence gradient: additive → subtractive → affirmative. Backstop at 3 turns.

---

## Phase 4: Where Does It Live? (2026-04-11)

### Option 1: Before work level detection

Propose-and-converge runs first, then classify patch/task/feature.

**Initially rejected:** Adds ceremony to obvious patches. **Later adopted** when Scenario 4 (depth scaling) resolved the ceremony concern — patches converge in 0 turns, so no added ceremony. Final design puts understanding before detection.

### Option 2: Replaces work level detection (north star)

Work level is emergent — convergence depth reveals scope. 0 turns = patch, 1 = task, 2-3 = feature.

**Explored deeply (see Phase 6).** Most elegant but has enforcement gaps.

### Option 3: Within each workflow, detection stays

Detection tree routes to workflow. Propose-and-converge replaces questioning within each workflow.

**Initially selected as pragmatic step.** Detection is load-bearing for downstream routing. Propose-and-converge fixes _how_ the agent enters each workflow.

---

## Phase 5: Discovery Phase Integration (2026-04-11)

How does propose-and-converge relate to BDD Discovery (Phase 0-2)?

### Sub-option A: Replace DISCOVERY.md entirely

Discovery becomes propose-and-converge. One pattern, one file.

**Rejected:** Discovery has structured rounds (UX, failure modes, boundaries) that are valuable for complex features.

### Sub-option B: Additive — propose-and-converge in SAFEWORD.md, keep DISCOVERY.md

Two overlapping concepts. Which runs first?

**Rejected:** Confusing overlap.

### Sub-option C: Discovery rounds are techniques within propose-and-converge

Propose-and-converge is universal intake. For complex features, the agent uses discovery rounds as contribution content. Not a separate phase.

**Selected.** Cleanest model. Discovery is a technique, not a phase. BDD phases collapse: 0-2 absorbed into propose-and-converge.

---

## Phase 6: Emergent Classification Deep Dive (2026-04-11)

Can the detection tree be eliminated entirely?

### Load-bearing analysis

3 true dependencies on classification:

1. Stop hook done gate (feature requires audit + scenarios evidence)
2. BDD skill routing (7 phases vs 3-phase TDD)
3. Cumulative artifact check (test-definitions.md enforcement)

Everything else is already phase-gated, not type-gated.

### Approach A: Artifact-driven routing

Replace `type === 'feature'` checks with artifact existence checks. Has test-definitions.md → feature enforcement.

**Strength:** No classification needed. Artifacts are source of truth.
**Weakness:** Agent must decide _when_ to create test-definitions.md. Without the tree, what triggers that decision?

### Approach B: Escalation triggers

Start everything as patch. Escalate on signals (file count, test count).

**Rejected:** Escalation mid-stream is disruptive. Backtracking costs more than upfront classification.

### Approach C: Soft declaration in proposal

Agent proposes scope as part of its final proposal: "This touches 4 files with new state — I'd treat it as a feature with scenarios."

**Selected within this phase.** Best of both worlds. No upfront interrogation, classification embedded in proposal, user can override.

---

## Phase 7: Silent Detection Tree as Safety Net (2026-04-11)

Steelmanning: agents under-scope to avoid work. Can we trust the agent's self-assessment?

### The multi-layer heuristic system

Three layers proposed:

1. Parse agent's proposal (component count, state language, hedging detection)
2. Import-graph fan-out (grep for importers of touched files)
3. Git co-change mining (historical blast radius)

**Rejected as bloat.** Two of three layers replicate judgment the LLM already has. Building TypeScript to parse LLM text so the LLM can check its own text is a round-trip that adds complexity without adding intelligence.

### The three-sentence approach

Replace the entire detection tree + heuristic system with three text changes:

1. SAFEWORD.md: "After your proposal, self-check: does your scope match your description?"
2. prompt-questions.ts: "Contribute before asking"
3. Stop hook: "Does scope match complexity signals?"

**Strength:** Elegant. Zero new code. Claude is the best parser of Claude's output.
**Weakness:** Steelman revealed 5 failure modes:

1. **Fox guarding henhouse** — agent evaluates its own under-scoped proposal and finds it consistent
2. **Context compaction** — self-check in SAFEWORD.md gets compacted away mid-session
3. **Rationalization** — LLMs confabulate justifications for "why scenarios aren't needed" effortlessly
4. **No enforcement teeth** — self-check is advisory, nothing blocks if agent ignores it
5. **Combinatorial blindspot** — agent evaluates components individually, misses interaction complexity

### Current leading approach: Tree as mandatory self-check

Propose-and-converge for UX (no interrogation). Detection tree moves from conversation driver to mandatory self-check re-injected every turn via prompt hook. Pre-tool enforcement stays (teeth). Agent must reconcile if tree disagrees with its assessment.

**Properties:**

- Propose-and-converge UX (no interrogation) ✓
- Tree survives compaction (re-injected by prompt hook) ✓
- Incorruptible structural signals (3+ files + new state) ✓
- Pre-tool enforcement blocks edits in wrong phases (teeth) ✓
- Agent can explain why tree is wrong, but must do so explicitly ✓
- Never announces "FEATURE DETECTED" to user ✓

---

## Phase 8: Intake Substeps and Scoping (2026-04-11)

Decomposed "intake" into Understanding → Sizing → Scoping → Planning.

### Key discovery: Scoping collapses into Understanding

Every open question resolved during propose-and-converge produces scope: the choice = In Scope, the rejected alternatives = Out of Scope. Scoping is not a separate step — it's how understanding ends. The final turn of propose-and-converge includes structured scope derived from resolved questions.

Four steps became three: Understanding+Scoping → Sizing → Planning.

### Steelman: Where does the collapsed model go wrong?

| Failure                                                                                        | Severity | Mitigated by                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Resolved questions produce shallow Out-of-Scope (product-level only, not implementation-level) | Medium   | Agent adds domain-knowledge exclusions + LOC gate + sizing enforcement catch implementation creep                                     |
| Patches get 0 resolved questions = no Out-of-Scope                                             | Low      | Mechanical gates (LOC, tests) are more effective for patches than written boundaries                                                  |
| Users skim boundaries in the proposal                                                          | Wash     | Same problem with separate step; embedding is no worse                                                                                |
| More cognitive load on the final turn                                                          | None     | Summary of decisions already made, not new work                                                                                       |
| Missing discovery's sideways-looking probes                                                    | Medium   | Discovery techniques still available as contribution content; instruction encourages failure-mode thinking when drafting Out of Scope |

**Verdict:** Proposal holds. No structural weakness warranting a fourth step.

---

## Key Research Citations

See `.safeword-project/learnings/propose-and-converge-research.md` for full sourced principles.

Core findings applied:

- "Contribute before you extract" — questions feel collaborative after a contribution, adversarial before one
- "Proposals are cheaper than questions" — reviewing costs less cognitive effort than answering
- "Bias toward action with lightweight checkpoints" — developers prefer wrong-but-fast over thorough-but-slow
- "Convergence follows a gradient" — additive → subtractive → affirmative (Clark & Schaefer)
- "Self-review works for surface-level checks, unreliable for deep logic" (Huang et al., 2023)
- "Safety monotonicity" — guardrails can only escalate, never downgrade (Anthropic responsible scaling)
