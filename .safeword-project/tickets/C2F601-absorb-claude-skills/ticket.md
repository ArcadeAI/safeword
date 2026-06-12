---
id: C2F601
slug: absorb-claude-skills
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: in_progress
created: 2026-06-06T18:30:46.854Z
last_modified: 2026-06-06T18:30:46.854Z
---

# Audit Claude Code + Cowork skills and decide what goodness to absorb

**Goal:** Audit the skills Claude Code and Claude Cowork ship, decide which capabilities safeword should absorb — and for each, whether to **adopt / adapt / reference / skip** and how.

**Why:** Anthropic ships a fast-growing skill set, and several overlap safeword's own surfaces — sometimes with more horsepower than ours: `code-review` (multi-agent cloud "ultra", `--comment`/`--fix`) vs. our `quality-review` + `audit`; `deep-research` (fan-out + adversarial verify + synthesize) vs. `figure-it-out`'s research; `skill-creator` (create + **eval + benchmark + optimize-description**) vs. our hand-authored skills with no eval harness; `consolidate-memory` vs. our MEMORY.md. Left undecided, we either reinvent what exists or silently diverge from it. This is a deliberate "absorb the goodness" pass.

> Status: **intake**. Research-epic — produces a decision per candidate and likely fans out to child absorb-tickets. The inventory below is a starting point from the currently-visible skill set; the audit completes it (the live set changes).

## Candidate inventory (starter — grouped by overlap with safeword)

- **Review / quality** — `code-review` (multi-agent ultra, inline-comment/auto-fix), `simplify`, `security-review`, `review` ↔ safeword `quality-review` + `audit`. Where theirs is stronger (adversarial multi-agent), decide replace / wrap / defer.
- **Research** — `deep-research` (fan-out web search → fetch → adversarially verify → cited synthesis) ↔ `figure-it-out`. Could uplevel our research rigor.
- **Skill authoring** — `skill-creator` — eval + variance benchmark + description-trigger optimization. Safeword authors many skills with **no** eval harness; high-value absorb (test our own skills' triggering).
- **Memory** — `consolidate-memory` (reflective merge / prune / index) ↔ safeword's MEMORY.md flow.
- **Verify / run** — Claude Code `verify` (run the app, observe behavior) + `run` ↔ safeword `verify` (tests/build/lint). Absorb "actually exercise the app", which we don't do.
- **Scheduling** — `loop`, `schedule` ↔ the monitor / upstream-changelog epics.
- **Context init** — `init` (CLAUDE.md) ↔ context-files-guide.

## Absorb framework (the decision shape — open)

Classify each candidate's outcome: **Adopt** (invoke the Anthropic skill directly, don't reinvent) · **Adapt** (port the idea into a safeword skill tuned to our phases/gates) · **Reference** (point users at it, keep external) · **Skip**. Rough rule to pressure-test: overlaps a **gate-enforced** safeword surface → _adapt_ (keep the enforcement); standalone capability → _adopt_.

## Open questions (converge before spec)

- **Absorb vs. depend.** Safeword ships to customer repos; can it _depend_ on Anthropic skills/plugins that may not be installed, or must it copy/adapt to stay self-contained? This gates Adopt-vs-Adapt for the whole audit.
- **Overlap resolution.** Where Anthropic's is clearly stronger (`code-review` ultra vs. `quality-review`), do we replace ours, wrap it, or defer to it?
- **Scope of "relevant".** Dev/quality skills only, or also the PM and document (docx/pdf/pptx/xlsx) packs? Lean: dev/quality first; PM/doc out of scope unless safeword expands there.
- **One-time vs. recurring.** A single audit, or a standing "track upstream skills" monitor (cf. the changelog-monitor epics) so we don't re-diverge?

## Related

- [9BDDGP-dynamic-workflows-for-safeword](../9BDDGP-dynamic-workflows-for-safeword/ticket.md) — split out deliberately; workflows are the orchestration layer that backs some of these skills (`deep-research`, `code-review` ultra).
- [ZBVGPF-embed-figure-it-out](../ZBVGPF-embed-figure-it-out/ticket.md) — `deep-research` ↔ figure-it-out.
- [263422-audit-deps-vs-dependabot](../263422-audit-deps-vs-dependabot/ticket.md) — `code-review` / our `audit` overlap surfaces here too.

## Work Log

- 2026-06-06T18:30:46.854Z Started: Created ticket C2F601
