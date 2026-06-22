# Raw findings: agent clarification, sufficiency thresholds, constraint handling

Raw web-search evidence from the TPP6Y2 figure-it-out passes. Synthesized into the ticket's Decision section and `propose-and-converge-research.md`.

## When should an LLM agent ask vs. act (the core question)

- **CaRT — "Teaching LLM Agents to Know When They Know Enough"** (arXiv 2510.08517). Frames two opposing failure modes: **over-asking** (wastes effort, frustrates users, erodes trust) and **under-asking** (acts on incomplete info, wrong output). The skill is the _threshold_ — recognizing when additional questions yield diminishing returns — not the asking itself. Trains task-completion-feasibility confidence thresholds rather than fixed heuristics. https://arxiv.org/pdf/2510.08517
- **"Learning to Ask: When LLM Agents Meet Unclear Instruction"** (EMNLP 2025 main 1104). Benchmarks clarifying agents; metrics include clarification rate, good-question rate, over-/under-questioning, dialogue efficiency, information recovery. https://aclanthology.org/2025.emnlp-main.1104.pdf
- **Clarifying agent definition** (emergentmind): generate clarification questions until sufficient info OR further questions yield no added utility, then act. Up to +83% downstream accuracy (CoA / VQA) over strong baselines in some tasks.

## Value of Information — the triage knobs

- **"Value of Information: A Framework for Human-Agent Communication"** (arXiv 2601.06407). Ask only when expected benefit of the improved decision outweighs interaction cost. Three factors: **Query Ambiguity**, **Task Risk**, **Cognitive Load**. https://arxiv.org/pdf/2601.06407
- **Plan-Then-Execute** (arXiv 2502.01390): over-asking erodes trust too — "unnecessary repetition of information may diminish user trust"; under-questioning (confident-but-wrong) also erodes trust. Not a linear "more questions = safer" relationship. https://arxiv.org/pdf/2502.01390

## Structured scaffold vs. internal reasoning (is an explicit question set worth it?)

- **"Exploring the Necessity of Reasoning in LLM-based Agent Scenarios"** (arXiv 2503.11074). Field is _unsettled_ on whether explicit structured/tool-based reasoning complements or merely **duplicates** internal model reasoning; explicit reasoning adds computational overhead and can diminish efficiency in time-critical contexts. 2025 study: 17.14% of agent failures are step-repetitions, 13.98% reasoning/action mismatches. https://arxiv.org/pdf/2503.11074
- Implication for TPP6Y2: keep the self-test lightweight (≤5 plain prompts), gate by blast radius; an exhaustive structured form risks pure overhead.

## Constraints are where coding agents fail (load-bearing)

- **"Constraint Decay: The Fragility of LLM Agents in Backend Code Generation"** (arXiv 2605.06445). Agent performance **declines as structural / non-functional constraints accumulate**. Production software needs strict adherence to NFRs (architectural patterns, DBs, ORMs) yet benchmarks overlook them. https://arxiv.org/abs/2605.06445
- Cuts both ways: constraints matter enormously (surface them) BUT piling them on degrades the agent (surface only the load-bearing one — "what must not break / reversibility" — never an NFR sweep).

## Cost of fixing defects early vs. late (corroborating, not load-bearing)

- Requirements defect: ~20 min–4 hr to fix at requirements stage vs. 2–15 hr at development (ScopeMaster). IBM Systems Sciences Institute: post-release fix 4–5× design-stage, up to 100× maintenance-phase. Some cite 20–400× post-release vs. dev. ~4 staff-hours (~$200) saved per defect caught early.
- **Honest caveat** (arXiv 1609.04886, "Revisiting Cost-to-Fix"): the delayed-issue cost evidence is "both very sparse and very old" — principle widely accepted, specific multipliers shaky. Treat as corroborating only. https://arxiv.org/pdf/1609.04886

## 2026 agentic-coding workflow consensus

- Balance upfront spec clarity with iterative refinement (Addy Osmani, "My LLM coding workflow going into 2026"). Ask the LLM to iteratively ask questions until requirements/edge-cases are fleshed out, compile to a spec.md (requirements, architecture, data models, testing, constraints, known pitfalls). Small iterative loops reduce catastrophic errors. https://medium.com/@addyosmani/my-llm-coding-workflow-going-into-2026-52fe1681325e
