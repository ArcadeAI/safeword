# Impl Plan: Plain-first gate blocks

**Status:** planned

## Approach

**Riskiest assumption:** that a single structured block shape — `{ lead, next, detail? }` — can carry all seven existing gate messages while satisfying the hardest rule, R3 (no bare internal term). The other three rules fall out of the shape for free (lead is the first field → R1; exactly one `next` field → R2; `/explain` only ever in the optional `detail` field → R4). R3 is the one that needs real rewriting of copy. **Cheapest proof:** migrate the two densest-jargon gates (done, plan) to the shape and run the R3 conforming check over them — if those two rewrite clean, the five lighter gates are easier. That is slice 1.

**Design.** Introduce `.safeword/hooks/lib/block-messages.ts`: a `BlockMessage = { lead: string; next: string; detail?: string }` type, one builder per gate returning it, and `renderBlock(block, harness)` that concatenates for display (harness picks the detail command — `/explain` on Claude Code, `$explain` on Codex). The plainness guard `checkBlock(block): Violation[]` lives beside it and encodes R1–R4 over the structured form: lead non-empty and not starting with a token from the enumerated internal-term set (R1); exactly one `next` line (R2); no bare term from that set appearing unglossed in `lead`/`next` (R3); `next` is not "run /explain" and `/explain` appears only in `detail` (R4).

**Proof plan** (primary proof per scenario, per `testing/SKILL.md` highest-practical-scope):

- Conforming R1/R2/R3/R4 — **unit** over the real builders (the guard iterates all seven; the "every one of the seven gates produced a message" step is a registry-completeness assert). Unit is enough: each property is a pure function of the message. This test importing the real builders (no mocks) **is** the wiring coverage for the new lib.
- Rejection outlines — **unit**: feed `checkBlock` crafted blocks (token-first lead per class; zero/two next lines; bare term per class; /explain-as-next and /explain-as-required).
- Cross-surface parity — **unit** over `renderBlock(block, 'cursor'|'codex')` asserting the same properties hold and only the detail command differs.
- One **integration** proof (extend `tests/integration/quality-gates.test.ts`) that a real gate fire renders the built block through `deny()` — wiring the builders to the actual hook output.

**Build order** (load-bearing slice first):

1. **Slice 1 (load-bearing):** `BlockMessage` type + `renderBlock` + `checkBlock` guard + the **done** and **plan** gate builders; unit-prove R1–R4 incl. R3 on those two, plus all rejection outlines. A wrong shape fails here while cheap.
2. Migrate the remaining five gates (LOC, phase, spec/JTBD/criteria, bash-ledger, process-kill) to builders; conforming scenarios now cover all seven.
3. Wire `pre-tool-quality.ts` / `stop-quality.ts` / `plan-gate.ts` `deny()` sites to render from the builders; update the string-asserting tests (`quality-gates`, `readiness-pointer`, `gate-escalation`).
4. Adapter parity: point the Codex (`hooks/codex/pre-tool-quality.ts`) and Cursor (`hooks/cursor/gate-adapter.ts`) renderers at `renderBlock`; prove the cross-surface scenario.

**Surface coverage:** Claude Code — slices 1–3. Cursor + OpenAI Codex — slice 4.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Message representation | Structured `{ lead, next, detail? }` | Keep free-form strings, regex-parse in the guard | Brittle parse; reintroduces the vacuity/coverage holes the scenario review flagged — structure makes R1/R2/R4 true by construction |
| Plainness check tier | Deterministic guard (pure function) run as a unit test | LLM judge scores plainness | Wrong reviewer tier (Principle 1): this is an *observable fact*, not a judgment on produced work — a judge adds nondeterminism and cost for no gain |
| R3 term detection | Enumerated internal-term list scanned in lead/next | Open-ended "is this jargon" heuristic | Non-deterministic; the scenario review requires a closed set |
| Guard scope | Test-time regression lock over builders | Runtime gate that blocks on non-plain copy | Out of scope — enforcement is untouched; the lock is a dev-time test, not a new user-facing gate |

## Arch alignment

Honors PRINCIPLES.md #1 (enforcement hierarchy — the guard is a tier-2 *observation* over an observable fact, not a self-report) and #3 (add, never replace — text-only; no gate trigger, threshold, or condition changes). No formal ADRs govern hook message shape. skip: no ADR needed — reversible, local, within existing hook-lib patterns (`active-ticket.ts`, `quality-state.ts`).

## Known deviations

skip: no deviations planned — `block-messages.ts` follows the existing `hooks/lib/*` module pattern (typed helpers + shared constants), and the dogfood template/`.safeword` mirror is edited in lockstep as the parity guard requires.

## Doc impact

skip: internal, agent-facing surface. `docs.sources` (README.md, packages/website docs) describe safeword's workflow, not the verbatim text of gate blocks; no customer-visible doc pins these strings. If any doc quotes a block message, slice 3 updates it — checked at implement.

## Assessment triggers

- A new hard block is added → it must ship as a builder, or the guard's all-seven-present check fails (the design forces new blocks through the plain shape).
- A new harness with a different detail command → add a case to `renderBlock`.
- If block copy ever needs runtime enforcement (block on non-plain text, not just a test) → revisit the test-only guard scope.
