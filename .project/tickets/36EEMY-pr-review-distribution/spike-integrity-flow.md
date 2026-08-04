# Spike result: technology-neutral integrity flow

**Status:** VALIDATED with production blockers

- **Question:** Can an unfamiliar changed artifact travel through Safeword's real PR-review command, receive a mandatory integrity review from Codex, and produce an inline finding plus review receipt?
- **Hypothesis:** The existing bundle, vendor adapter, parser, and poster can carry this flow with a small mandatory integrity instruction.
- **Pre-spike base:** `d1ed21eb43f4b5af78ec4a43ff5a56338dd01408`
- **Proof:** Run the real `reviewPrCommand` over a temporary Git repository containing a `.flux` policy diff (`allow admin` → `allow *`). Fake only GitHub HTTP; invoke the real Codex CLI and production `gpt-5.6-sol` model.
- **Evidence:** Codex identified the access-control regression. Safeword parsed it, derived `needs-a-human`, and generated an inline-comment request plus a neutral check-run receipt. The live run took 15 seconds and reported 14,721 input tokens, 256 output tokens, and 63 reasoning tokens. Focused reviewer contract tests passed 19/19 after the experimental schema correction.

## Blockers discovered

1. **CLI compatibility:** Codex CLI `0.141.0` could not parse the current model catalogue and could not use `gpt-5.6-sol`. Upgrading to `0.146.0` cleared this blocker.
2. **Invalid structured-output schema:** Safeword declared optional object properties without including them in `required`. Real Codex rejected the schema before inference. The experimental branch requires every declared property, satisfying Codex structured-output rules.
3. **False fix-verification claim:** Codex returned a plausible `suggestedFix`, but Safeword's poster rendered it as “run against the affected tests.” No tests had run. The model merely populated a text field; Safeword mistakenly treated the field's presence as proof.

## Safety consequence

A model-proposed remedy is unverified by default. Only Safeword-controlled evidence may upgrade it to verified: Safeword must apply the exact patch in an execution-eligible sandbox, run named relevant checks, and record their results. On an untrusted fork, Safeword must not execute code; the remedy stays explicitly unverified or is omitted. The model cannot certify its own remedy by setting a field.

## Decision

The internal end-to-end direction is viable. Do not merge the spike commits directly. Production planning must carry forward the valid Codex schema, mandatory integrity floor, CLI compatibility check, and an evidence-bearing remedy-verification state that the poster cannot infer from model text.
