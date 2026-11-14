# Keep the strengthened native proof isolated

Follow-up to independent Claude review `d33439d2-d2da-4998-ab67-c357c04a07ea`.
The reviewer approved the three test edits and identified non-blocking fixture
risks. This final test-only slice addresses its three warnings:

- The cachebusted-generation protection includes Product's reviewer output and
  the planning-family contract/identity output, in addition to existing rubrics.
- Every native fixture snapshots all review/planning `.generated.ts` file bytes
  and mtimes before generation, and checks them unchanged afterward. This detects
  in-tree rewrites even when bytes happen to be identical. It is detection, not a
  claim that unrelated external generator processes are serialized by this test.
- CLI subprocesses use an explicit environment: private fixture HOME/CODEX_HOME,
  isolated PATH and review keys, explicit author identity, and test/update flags.
  No developer host variables or credentials are inherited by review dispatch.
- Missing-asset refusal now also asserts the public `blocked` status.

The single-supported-value invalidation table remains a minor style advisory;
its Purpose mutation and the eight invalid-direction cases provide the actual
discriminating proof. No new admission, corpus, prompt or production behavior is
introduced. The Claude Execution asset-layout exception documented in
`5041-review-followup.md` remains explicit.

Focused native and bundle checks passed 25/25 after these changes. Final full
verification is running separately. Review these fixture protections for actual
isolation and assertion quality; do not infer epic completion, semantic live
qualification, or native UI coverage from them.
