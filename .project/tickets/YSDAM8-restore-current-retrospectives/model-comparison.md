# Luna versus Sol for retrospective extraction

Decision on 2026-10-17: use **gpt-6-luna with low reasoning**. The user explicitly
approved this after reviewing the screening result. Astra was rejected for cost.

## Method

Predeclared six inputs and their expected finding presence before running either
candidate. Both used the real buildAutoExtractor, digest builder, prompt,
strict findings schema, neutral directory and read-only sandbox with hooks/MCP
disabled. Only the Codex subprocess boundary was instrumented to capture exit,
latency and token usage and to pass low reasoning to both candidates. Ran
sequentially with alternating model order through pinned Codex CLI 0.160.0 and
ChatGPT authentication. Findings were inspected for grounding, not only count.
No retrospective issues were filed.

| Predeclared case | Expected | Luna low | Sol low |
| --- | --- | --- | --- |
| Clean ordinary session | No finding | Pass | Pass |
| Explicit wrong-worktree readiness bug | Finding | Pass | Pass |
| Host-project payment bug, Safeword correct | No finding | Pass | Pass |
| Readiness correctly refuses an unfinished ticket | No finding | Pass | Pass |
| Repeated gate loop despite fresh approval and stamp | Finding | Pass | Pass |
| Install falsely reports success, buried among routine messages | Finding | Pass | Pass |

All 12 calls exited zero with schema-valid output. Each model identified the
same three bugs with the correct surface and concrete consequence; neither
invented a finding for the three negatives. Median observed end-to-end times
were 7.27 seconds for Luna and 7.90 seconds for Sol. Six calls per model do not
establish a reliable latency difference.

## Cost and choice

Current standard API rates per million tokens:

| Model | Uncached input | Output |
| --- | --- | --- |
| GPT-6 Luna | $0.10 | $0.50 |
| GPT-6.1 Sol | $2.00 | $10.00 |

The unit rates are 20 times lower for Luna, not a claim of 20 times lower actual
account charges. Cache usage, reasoning/output volume, service tier and login
plan affect the real comparison. These calls used ChatGPT authentication;
subscription consumption was not measured in dollars.

Sol is the stronger general-purpose choice when difficult inference warrants
its cost. Luna is sufficient on this bounded extraction screening and fits the
user's cost preference, so choose Luna low. Existing explicit model overrides
remain available; no fallback/discovery framework was added.

Premortem: Luna could miss subtle friction in much longer real transcripts.
This small synthetic screening is not a production-quality benchmark or proof
of equivalence, and does not test the entire 180,000-character digest cap.

## Evidence

- Plan: `.project/tmp/retro-model-comparison-plan.md`
- Reproducible local harness: `.project/tmp/retro-model-compare.ts`
- All inputs, model order and capture logic are in that harness.
- Raw findings and usage: `.project/tmp/retro-model-comparison.jsonl`
- Runtime progress: `.project/tmp/retro-model-comparison-progress.log`
- Official Luna specs/pricing: https://developers.openai.com/api/docs/models/gpt-6-luna
- Official Sol specs/pricing: https://developers.openai.com/api/docs/models/gpt-6.1-sol
