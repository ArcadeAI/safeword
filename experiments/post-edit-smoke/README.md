# Post-edit agent-response smoke

One opt-in Claude task for #2810/#2809. The agent adds an import, receives the
real Safeword hook's diagnostics, then uses that import. It must finish a working
greeting function without changing an unrelated, deliberately unformatted export.
The prompt specifies the two edits but does not tell the agent how to handle lint
feedback. This is an elicited two-edit smoke, not a natural-workflow reliability
measurement or evidence for other hosts/models.

From the repository root:

```sh
# No model calls: prove the real hook emits the intended diagnostic and preserves bytes.
scripts/dev bun experiments/post-edit-smoke/run.ts --probe --out .project/tmp/edit-probe-1

# One model launch; no automatic retries. Output directory must not already exist.
scripts/dev bun experiments/post-edit-smoke/run.ts --live --out .project/tmp/edit-live-1

# Deterministic grader calibration; no model calls.
scripts/dev bun run --cwd packages/cli test tests/hooks/post-edit-agent-eval.test.ts
```

Requires the installed, signed-in `claude` CLI and this checkout's installed ESLint
and Bun. A private fixture launcher calls the existing ESLint executable; the
fixture has no symlink into shared dependencies. No installation or global profile
changes. Claude receives only Read/Edit/Write tools, project settings, and no MCP
servers. The fixture is deleted in finally; artifacts remain in the chosen output
directory. The recording wrapper forwards actual hook output unchanged. This is
not a sandbox against a hostile model or hostile user configuration.

## Cost and verdict

Pinned model: `claude-haiku-4-5-20251001`. At most eight turns, 120 seconds, and a
$0.10 CLI estimated-spend limit. The dollar limit can overshoot and can differ
from billing; it is not a hard billing guarantee. The runner reports observed
estimated cost when the CLI provides it. One invocation never retries or runs a
second AI judge. Keep it opt-in, outside normal CI. A rerun is a new observation,
not a replacement for a failed record.

- **Pass (exit 0):** successful agent termination, observed intermediate unused
  import feedback, non-mutating successful hook processes, required import still
  present, exact unrelated export bytes preserved at every recorded edit and at
  completion, unchanged helper, and correct outputs for three frozen inputs.
- **Fail (exit 1):** the agent completed and encountered the warning, but the
  observed edits or final task violate those checks.
- **Inconclusive (exit 2):** auth/process/format/budget/turn/runtime failure, or no
  intermediate unused-import warning. A combined import-and-use edit does not
  exercise this case and is inconclusive, not an agent regression.

Inspect result.json, agent.json, agent.stderr, hooks.jsonl, and final.mjs. Records
include prompt, model, CLI version, commit, hook hash, cost, and turn count. Do not
interpret one pass as a rate; failures belong to the hook maintainer for inspection
of task framing, agent trace, and actual hook output before changing behavior.

The grader calibration includes a known-good trajectory and bad outputs: no-op,
missing checker feedback, failed hook process, absent warning, removed import, hook mutation, transient
or final unrelated rewrites, modified helper, incomplete agent, and wrong output.
No model self-report is accepted as task-completion evidence.

The CLI controls were checked against the local help and the official
[CLI reference](https://code.claude.com/docs/en/cli-reference) on 2026-11-14.

## First local observation

2026-11-14T05:35:10Z: **pass**, five turns, approximately eleven seconds,
estimated cost **$0.021314**. The CLI reported the pinned model above, version
2.1.314. The first actual hook response reported the unused import and unrelated
formatting; the second reported only formatting. Both hook observations preserved
file bytes, and the agent completed the task without changing the unrelated line.
All three functional inputs passed. There was one live launch, with no retry or
AI judge. This is a single elicited smoke observation, not a reliability estimate.

Local raw artifacts: `.project/tmp/3J0QCR-live-1/`. The checked production hook
entrypoint hash was `70cc0df515e09ca0f786e758f6649c6339fd1f0ee52c74431ec59bb50e422abb`
at production HEAD `5454818bf9cc184e81969e2d7e388d0b21b057b7`; the experiment was
uncommitted at launch. No claim is made that this commit contains the experiment.
The initial observation used a dependency-directory symlink; afterward that was
replaced with the private launcher and validated by the no-cost real-hook probe.
No additional model run was made during that initial build; the later final-layout
observation below closes that evidence gap.

## Final-layout observation

2026-11-14T14:42:54Z: **pass** on the committed private-launcher fixture at
`c7ca7253eceabeeefe0b9344794492019f9c2fff`. The user requested this separate
observation; it was not an automatic retry. The pinned Haiku model completed in
five turns and 9,473ms, with estimated cost **$0.029803**. Both real hook
observations preserved bytes; the first reported the unused import and formatting,
and the second reported only formatting. The final task passed all three frozen
functional inputs and left the unrelated export unchanged.

Artifacts: `.project/tmp/3J0QCR-final-layout-20261114T1442/`. CLI version and hook
hash match the first observation. Total estimated cost across the two recorded
live runs is **$0.051117** (about 5.1 cents). Neither observation establishes a
reliability rate or coverage for another host/model. Live calls remain manual.
