# Feature Contribution: Finish accepted changes before asking for PR review

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** ZRJ9JJ
- **Milestone:** M2
- **Parent job:** prodigy-flow.TBU1
- **Killer Demo:** inherited from the parent spec

## Contribution

Make the accepted delivery flow self-propelling after implementation begins:
healthy GREEN and phase boundaries lead directly to the next required work,
while PR readiness remains unavailable until the feature has completed its
review, reconciliation, verification, audit, and done phases. A Draft PR needed
to obtain CI evidence may exist earlier, but it is not a terminal state.

## Rules

<!-- markdownlint-disable MD001 -->

#### prodigy-flow.TBU1.PY73VN.R1 — A successful TDD step advances to the next required delivery step without asking the builder to continue

#### prodigy-flow.TBU1.PY73VN.R2 — Completing the scenarios triggers whole-ticket closeout work and carries the ticket through verified done

#### prodigy-flow.TBU1.PY73VN.R3 — PR readiness cannot succeed or become the agent's terminal objective before verified done

#### prodigy-flow.TBU1.PY73VN.R4 — Only a genuine authority, safety, dependency, or scope boundary interrupts automatic continuation, and every interruption is resumable

<!-- markdownlint-enable MD001 -->

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- Cursor
- Safeword CLI

Unaffected:

- Claude Code Cloud — advisory-only until cloud sessions expose equivalent enforceable lifecycle boundaries
- OpenAI Codex Cloud — advisory-only until cloud tasks expose the local plugin lifecycle
- Cursor Cloud Agents — advisory-only where stop hooks are unavailable; transition gates remain covered by Cursor
