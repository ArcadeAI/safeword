---
id: GNSJ6P
slug: product-systems-loop-closing
title: "Epic: Loop-closing skills for product systems (Cagan POM + Torres OST workflow layer)"
type: feature
phase: intake
status: in_progress
epic: product-systems-loop-closing
created: 2026-05-25T01:25:31.625Z
last_modified: 2026-05-25T01:26:00.000Z
---

# Epic: Loop-closing skills for product systems

**Type:** Feature (epic — extends safeword above the feature level)

**Goal:** Add a small set of skills and a principles cluster that close the cross-feature feedback loop — from outcome signals fired in production, through reprioritization, sunset, experiment framing, and cross-feature initiative composition. The merged safeword (post Phase 0-3 absorption) covers the feature level cleanly; this epic adds the loop above it: signal → decision → next-feature, the layer Cagan's Product Operating Model describes but no tool implements.

**Why:** Web research (figure-it-out session 2026-05-25) confirmed the 2026 tooling gap: Productboard handles discovery, Linear/Jira handle execution, Aha handles roadmapping, but no tool occupies the **agent-driven workflow** layer that walks practitioners through loop-closing arcs. From Dragonboat's [roadmap-vs-portfolio analysis](https://dragonboat.io/blog/roadmap-tool-vs-product-portfolio-tool/): "Roadmap tools do not support iterative collaborations between product and engineering, or portfolio allocation." Most teams use 3-5 tools and pay an "integration tax." The gap is INTEGRATION/DISCIPLINE, not data modeling. This epic fills that workflow gap; it doesn't compete with the modeling tools.

**Sourced from:** figure-it-out research session 2026-05-25 — comparison of arcade+safeword feature-level discipline against Cagan's Product Operating Model ([SVPG](https://www.svpg.com/the-product-operating-model/)), Teresa Torres' continuous discovery ([Product School](https://productschool.com/blog/product-fundamentals/continuous-discovery)), and Team Topologies 2nd ed ([Team Topologies](https://teamtopologies.com/)).

## What this epic is NOT

- NOT a Productboard/Linear/Aha replacement. Those tools model the data; this epic adds the discipline arcs around them.
- NOT a portfolio-modeling tool (roadmap visualization, capacity planning, dependency mapping at scale). Existing tools cover this.
- NOT a project-management layer (assignments, dates, status reports). Those are existing-tool concerns.
- The skills here **read from and write back to** existing tools as data sources; they don't replace them.

## Tickets

| ID         | Title                                                                                       | Status | Depends On |
| ---------- | ------------------------------------------------------------------------------------------- | ------ | ---------- |
| **4RD1NS** | Extend unified principles rubric with product-systems cluster (Cagan POM + Torres OST + TT) | Open   | 3N3Q7B     |
| **AQ14K2** | /reprioritize skill — signal fired → decision: should this change what's next?              | Open   | —          |
| **6F432S** | /sunset skill — discipline the deprecation when signals are below threshold (or above hyp)  | Open   | —          |
| **PP7116** | /experiment skill — frame work as hypothesis with kill criteria, not a feature commit       | Open   | —          |
| **92TBNN** | /initiative skill — light cross-feature artifact for multi-feature, multi-quarter work      | Open   | —          |

**No arcade pair.** Net-new safeword capability; nothing in arcade to decommission. Arcade gets the loop-closing skills via normal `bunx safeword upgrade` once they ship.

## Sequencing

1. **4RD1NS** (principles cluster) — can ship anytime once 3N3Q7B (parent principles ticket) has the unified set landed. Provides the vocabulary the other 4 skills reference.
2. **AQ14K2 / 6F432S / PP7116 / 92TBNN** — all independent of each other; can ship in any order. Each is a standalone skill with its own artifact shape.

## Decisions required before execution

1. **Existing-tool integration boundary.** Each skill needs to know whether it READS from existing tools (Linear/Productboard/Jira) for context, or stays purely in safeword tickets. Driver leans hybrid — read existing-tool data via project-configured adapters (similar to JS5K5G's alert-routing adapters), keep safeword tickets as the workflow surface. **Open.**

2. **Signal-to-skill triggering.** When a signal breaches (per 1W107W signals skill), does it auto-suggest invoking /reprioritize or /sunset? Driver leans suggest-not-auto (alert routing per JS5K5G creates a Linear ticket; safeword side surfaces "consider /reprioritize" but doesn't auto-run). **Open.**

3. **Initiative artifact placement.** Initiatives span multiple tickets / multiple features. Do they live as a special ticket type (`type: initiative`), in a `.safeword-project/initiatives/` folder, or as a manifest in `.project/initiatives.md`? Driver leans special ticket type (reuses ticket-system infra, no new data location). **Open.**

4. **Sizing classifier.** Should the existing patch/task/feature sizing classifier add `experiment` as a new size? Or is `experiment` orthogonal (a feature that's TIME-BOXED and KILL-CRITERIA'd)? Driver leans orthogonal — experiment is a feature variant, not a fifth size. **Open.**

5. **Storage shape** — inherits from DZ2NM5/M6D315/S4997T epics.

## Out of scope (this epic)

- Replacing or competing with Productboard/Linear/Aha/Jira on data modeling. We READ from these tools, not REPLACE them.
- Roadmap visualization or capacity planning UIs — out of scope.
- Customer-feedback aggregation (intake from support tickets, surveys, sales notes) — out of scope; Productboard et al. cover this.
- Multi-team coordination patterns at scale — Team Topologies vocabulary lands in the principles cluster (4RD1NS) but the org-design work itself is out of scope.
- A `/discover` skill (continuous discovery workflow) — could be a future addition, but Torres' Opportunity Solution Tree work is mature enough that it might better fit as documentation / reference rather than as a safeword skill. Reassess after the 4 loop-closing skills ship.

## Done when

- 4RD1NS lands: principles rubric (3N3Q7B's output) has a third cluster covering product-systems principles.
- All 4 loop-closing skills (AQ14K2, 6F432S, PP7116, 92TBNN) ship with documented invocation patterns.
- Each skill has a worked example showing the discipline arc end-to-end.
- Skills explicitly document their integration boundary (what they read from existing tools, what they write to safeword tickets).
- A test project walks through a complete loop: feature ships → signal fires → /reprioritize invoked → next-cycle decision documented.

## Related

- **3N3Q7B** (principles rubric) — 4RD1NS extends its output with the product-systems cluster.
- **1W107W** (signals skill, Phase 3 epic) — signal-breach events are the primary trigger for /reprioritize and /sunset.
- **JS5K5G** (pluggable alert routing, Phase 3 epic) — same adapter pattern used by these skills for reading data from external tools.
- **70G298** (repo-level extensibility) — organizations may want to extend these skills with org-specific reprioritization rituals; provides the extension surface.

## Work Log

- 2026-05-25T01:25:31.625Z Started: Created ticket GNSJ6P
- 2026-05-25T01:26:00.000Z Drafted: Epic shell with 5 children, sequencing, 5 open decisions, explicit "not" clauses to prevent tool-replacement scope creep
