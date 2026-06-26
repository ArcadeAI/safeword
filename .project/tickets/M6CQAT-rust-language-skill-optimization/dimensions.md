# Dimensions: Rust language skill optimization

| Dimension | Choice | Why It Matters | Out-of-Scope Edge |
| --- | --- | --- | --- |
| Language | Rust only | Proves one language before duplicating the harness for Go. | Go language skill work. |
| Repository split | Whole repository: train, validation, held-out | Prevents repo-local memorization from masquerading as general Rust skill. | Task-level random split. |
| Pilot size | Small, mixed Rust pilot before 30-repo scale | Keeps sandbox/runtime cost visible while validating the evaluator. | Full corpus before evaluator trust. |
| Primary signal | Executable oracle in sandbox | Correctness must come from build/test/lint/verifier output, not a soft judge. | LLM judge as primary score. |
| Sandbox boundary | Digest-pinned Docker image, no Docker socket, no privileged mode, non-root/rootless or user namespace, restricted mounts | Third-party build scripts and agent patches are untrusted code. | Plain `docker run` with host-level defaults. |
| Optimization candidates | No skill, human seed, optimized skill | Shows uplift over both baseline and human-authored guidance. | Only comparing optimized vs current prompt. |
| Model coverage | Claude Opus and GPT/Codex | A skill that helps one model but hurts another should not ship silently. | Single-model optimization. |
| Aggregation | Macro-average by repository and model | Prevents large/easy task groups from hiding regressions. | Raw task-weighted headline only. |
| Feedback exposure | Rich diagnostics without eval-shape leakage | GEPA needs actionable side information, but not exploitable structure. | Revealing split names or fixture regularity. |
| Shipping path | Human-distill before template changes | Raw optimizer output can be bloated, memorized, or eval-aware. | Auto-apply GEPA winner. |
| Product install | Rust pack conditional install after gates pass | Rust projects get guidance without polluting non-Rust repos. | Unconditional global skill install. |
