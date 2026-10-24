# Named required-result recovery proof

The real Node CLI proof now fails with:

`Required-result refusal must name the exact assertion`

Run `scripts/dev node --import tsx --test --test-concurrency=1 packages/cli/tests/integration/bounded-observation-failures.node.ts`.
This separate Node entry keeps the real runner outside Vitest. It implements the
accepted Execution Plan's required-result row and the three accepted outline
examples; it adds no public override or new behavior requirement.

The first controlled candidate renames one reviewed required test declaration in
a disposable committed full-source checkout. The other fixed tests remain real.
The registration control also rejects that missing declaration, so the real
runner exits unsuccessfully. That is a valid unsuccessful required-proof case:
the public refusal must still identify the missing required assertion. Today it
reports only `Fixed runner failed (exit 1, signal null); repair the lane and rerun`.
The complete real report remains retained, but the observer exits before grading
it. The remaining skipped/failed controls share this exact command and targets;
the first failing example stops this RED run, so no execution of those later
examples is claimed yet.

An earlier harness run wrongly treated the CLI envelope's `ok` as observation
success. The existing result contract sets `ok: true` for `action_required` and
exit code 2. The corrected proof checks exit code 2 and `data.status: refused`,
then the exact assertion identity, recovery action and retained diagnostic.
The wrong-reason run receives no RED credit. Its raw log is retained compressed.

This evidence belongs only to PPHQN5. Historical RED, all original unfinished
checks and all 33 deferred case identities and owners remain unchanged.
