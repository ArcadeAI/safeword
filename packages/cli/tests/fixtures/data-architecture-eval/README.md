# Data architecture cold-start corpus

This repository-only corpus proves issue #4560 without putting maintainer commands in the shipped
guide. `cases.json` owns the nine hand-maintained rubrics, `contract.json` fixes model and decoding
identity, and `records.json` contains recorder-produced, content-bound results.

From `packages/cli`, record with a model adapter whose argv reads one prompt from stdin and writes
only the response JSON to stdout:

```bash
bun run data-architecture:record -- --adapter /absolute/path/to/model-adapter --arg value
```

The recorder runs the adapter in an empty temporary directory with a bounded timeout, reconstructs
the prompt from only the canonical guide, one case, the neutral response schema, and tools-disabled
state, re-grades the response, then atomically replaces `records.json` only when all nine pass.

Verify deterministically, without model or network access:

```bash
bun run data-architecture:verify
```

Refresh records whenever the guide, cases, rubric, model/version, decoding configuration, response
format, or rubric loader changes. The verifier rejects stale, missing, duplicate, or unknown records.
