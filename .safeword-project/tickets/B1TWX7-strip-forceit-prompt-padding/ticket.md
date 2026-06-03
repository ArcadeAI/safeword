---
id: B1TWX7
slug: strip-forceit-prompt-padding
type: task
phase: intake
status: wontfix
created: 2026-06-03T03:23:27.131Z
last_modified: 2026-06-03T03:28:00.000Z
---

# Strip defensive force-it prompt padding (Opus 4.8 literalism)

**Goal:** Tighten the hook/skill prompt injections — drop redundant emphatic "force-it" scaffolding (repeated CRITICAL/MUST warnings, belt-and-suspenders restatements) that the latest Opus's literal instruction-following can make counterproductive — without removing any load-bearing instruction.

**Why:** Live-docs research (workflow `wf_c57312ee-82c`, 2026-06-03): Opus 4.8 follows clear soft instructions more precisely, and Anthropic's own docs note defensive padding can _backfire_ (the model over-weights the emphasis). The reliability claims are **vendor-stated, not independently benchmarked, and effort-coupled** — so this is a conservative tidy of clearly-redundant emphasis, NOT a reason to weaken any gate.

**Scope:**

- Audit the per-turn prompt injections — `prompt-questions.ts` phase reminders, `quality.ts` `UNIVERSAL_HEADER`, the failure/escalation injections — for redundant emphasis (repeated all-caps imperatives, duplicated warnings, restating the same rule twice) and tighten each to one crisp statement.
- Audit skill prose (SAFEWORD.md, the bdd/verify/audit/refactor skills) for the same padding.
- Keep every actual instruction and every hard-gate **deny reason** (those are functional messages, not padding).

**Out of scope:**

- Any change to gate LOGIC or what blocks (prose-only).
- Demoting/removing instructions — only de-duplicating emphasis.
- Acting on Opus reliability claims as if measured (treat as directional).

**Done when:** Prompt/skill prose is tightened with no instruction lost; hook output contracts unchanged; full suite + parity green; a before/after diff shows only emphasis/redundancy removed.

## Work Log

- 2026-06-03T03:28:00.000Z **wontfix** (revalidate + /figure-it-out before building). Premise not borne out by the code: `SAFEWORD.md` has 0 emphatic tokens, the core per-turn injections are clean one-liners, and skills carry 0–5 — all load-bearing (security-severity labels, the skill-invocation-log STOP warning, a session-start "read SAFEWORD.md" pointer), not defensive padding. safeword already practices plain-speech via its own context-files-guide + "Talking to the user" rules. The justifying evidence (Opus 4.8 literalism) is vendor-stated + model-specific, while these prompts serve every model safeword's customers run — so stripping is make-work at best, compliance-harming at worst. Reversible: revive if independent benchmarks later show real over-padding on a specific surface.
- 2026-06-03T03:23:27.131Z Started: Created ticket B1TWX7 (follow-up from the CC/Opus/skills research workflow — the one transferable point from research Option D).
