# Killer Demo reviewer smoke evaluation

Four fixed cases test basic payoff and evidence judgments, not nuanced appeal
or reliability across unfamiliar products. Run when changing the demo standard
in `DISCOVERY.md`, before merging.
Owner: the author of that change. This is opt-in, spends reviewer tokens, and
does not belong in the default Vitest suite. No customer data or external writes.

Use the shared reviewer, one case per review, passing only `context.md` and
the shipped `packages/cli/templates/skills/bdd/DISCOVERY.md` as context:

```sh
bun run --cwd packages/cli build
bun packages/cli/dist/cli.js review run quality-review \
  --context experiments/killer-demo-eval/context.md \
  --context packages/cli/templates/skills/bdd/DISCOVERY.md \
  --agent-handoff --json -- experiments/killer-demo-eval/cases/a.md
```

Repeat for b, c and d. Resolve a review-capable CLI as described by
`quality-review` if the source build is unavailable. Collect pending review IDs
to completion; an unavailable, stale, or incomplete review is not a pass.
Keep this README and other cases out of the review packet so expected answers
and contrasts cannot cue the reviewer.

## Frozen expectations

| Case | Decision | Required reason                                                        |
| ---- | -------- | ---------------------------------------------------------------------- |
| a    | Accept   | Concrete time-saving payoff, checkable matches, bounded ambiguity      |
| b    | Reject   | Placeholders demonstrate no actual persona-facing payoff               |
| c    | Reject   | Upload works but leaves the user's reconciliation pain unchanged       |
| d    | Reject   | Certification and universal correctness exceed capability and evidence |

Inspect actual findings, not just exit codes. A rejection for an unrelated
reason does not pass; optional suggestions on a are not a failure. Record
review IDs, model, input hashes, decisions and the relevant findings in
`results.md`. Do not change these expectations to fit the output. On a miss,
inspect whether guidance, fixture or review delivery caused it before retrying.

This tests the independent reviewer given the real intake standard, not
automatic skill selection or the self-review stamp mechanism. Four cases are
a smoke check, not a measured reliability rate or proof across all hosts.
The semantic scenarios are tracked separately from Vitest proof mappings.
