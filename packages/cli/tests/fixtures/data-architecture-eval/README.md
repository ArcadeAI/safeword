# Data architecture cold-start corpus

This repository-only corpus proves issue #4560 without putting maintainer commands in the shipped
guide. `cases.json` owns the nine hand-maintained rubrics, `contract.json` fixes model and decoding
identity, `records.json` contains the nine recorder-produced full-guide results, and
`ablation-record.json` contains the paired recorder-produced named-ablation result.

From `packages/cli`, record with a model adapter whose argv reads one prompt from stdin and writes
only the response JSON to stdout:

```bash
bun run data-architecture:record -- --adapter /absolute/path/to/model-adapter --arg value
```

The recorder runs the adapter in an empty temporary directory with a bounded timeout, reconstructs
the prompt from only the canonical guide, one case, the neutral response schema, and tools-disabled
state, validates the adapter response shape, re-grades every full-guide result and the named
ablation pair, then replaces the evidence files only when the complete evaluation passes.

Verify deterministically, without model or network access:

```bash
bun run data-architecture:verify
```

The checked-in contract records the maintainer-selected `claude-opus-5` identity and Claude CLI
inference controls (`effort: high`, one turn, tools disabled); these are contract assertions rather
than independently observed provider behavior. Refresh records whenever the guide, cases, rubric,
model/version, inference configuration, response format, rubric loader, or named ablation changes.
The verifier rejects stale, missing, duplicate, unknown, or non-discriminating evidence.
