---
id: Y9P3ZC
slug: invariant-scenario-binding-lens
type: task
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/1425
scope:
  - Add an invariant-binding lens to review-spec's cross-cutting checks that pairs each normative spec.md clause with a scenario whose failure would falsify it.
  - Name the named-but-weaker binding as the defect it is — a scenario whose title matches the rule while its Given exercises a weaker precondition.
  - Regenerate the dogfood and Codex-plugin mirrors from the canonical template.
  - Cover the lens with a mirror-drift regression test in the shipped-skill documentation family.
out_of_scope:
  - Code-enforced extraction of normative clauses from spec.md; this lens is agent-run prose, like every other review-spec check.
  - Changing self-review's ownership of spec.md JTBD/criteria/persona framing.
  - Re-reviewing or amending closed tickets whose invariants are already unbound.
done_when:
  - review-spec's cross-cutting checks include an invariant-binding lens that requires a named falsifying condition, not just a scenario reference.
  - The lens states the named-but-weaker failure mode concretely enough that a reviewer would have caught QRX2DN's fallback rows.
  - All four review-spec surfaces (templates, .claude, .agents, codex-plugin) carry the lens and parity reports no drift.
  - A regression test fails if any surface loses the lens.
created: 2026-07-25T21:57:19.992Z
last_modified: 2026-07-25T21:57:19.992Z
---

# Bind spec invariants to falsifying scenarios

**Goal:** Stop a spec's "must never" from shipping with no scenario that would fail if it were violated.

**Why:** QRX2DN asserted an invariant, carried scenarios named after it that
exercised a weaker case, and shipped the defect the invariant forbade (#1425).
Nothing compares `spec.md`'s normative clauses against the scenario set —
`self-review` reads one, `review-spec` reads the other.

**Type note:** filed as `feature`, reclassified to `task`. The deliverable is
one cross-cutting lens in a skill plus its regenerated mirrors; the only honest
scenarios are surface-presence and drift, which a vitest drift test covers
directly. Cucumber steps asserting a string appears in four files would add
ceremony, not signal — and would be the vacuous shape this lens exists to
catch. `spec.md` is retained as the design record: it holds the resolved
review-spec-vs-self-review question and the evidence-limits reasoning.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-25T21:57:19.992Z Started: Created ticket Y9P3ZC
- 2026-07-25T22:06:16.916Z Phase: intake → verify
- 2026-07-25T22:50:31.946Z Phase: verify → done
- 2026-07-25T22:50:31.946Z Done: CI run 30177280263 green on lint, Dogfood parity, and the full suite on Node 22.22.3 + Node 24, supplying the full-suite evidence the authoring container could not (uid 0 bypasses the `0o555` assertion in an unrelated self-report test). Evidence in verify.md; PR #1433.
