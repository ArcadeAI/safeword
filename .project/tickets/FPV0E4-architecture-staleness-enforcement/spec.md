# Spec: Architecture doc staleness enforcement (Slice 2 — auto-fix on commit, fail CI, opt-out)

**Scope of this spec:** Slice 2 only (see ticket → Scope). Enforces freshness of
the Slice-1 generated doc (`.project/architecture.generated.md`) at agent
commit time (auto-fix-and-stage) and in CI (hard-fail backstop), default-on with
a per-project opt-out. No monorepo (Slice 3), no LLM prose, no change to the
hand-curated `paths.architecture` ADR record.

## Intent

Slice 1 makes the generated doc self-heal at session start and flag stale prose —
but only _warns_. A commit can still land, and reach `main`, carrying a stale
structural picture that silently misleads every agent that later loads it. This
slice closes the gap: during an agent session, a structural change is regenerated
and staged into the commit automatically (no human in the common case); and CI
hard-fails when a stale doc slips through — covering both a bypassed hook and a
human's hand-written commit, which safeword's local guardrails deliberately never
intercept. This is the "block later on the same thing" half of
inform-early/block-later.

## References

- Ticket FPV0E4 (resolved design: threshold map, config key, wiring)
- Slice 1 (QD5DTT, #316) — `selfHeal`, `decideAction`, shape-fingerprint,
  ownership marker — the deterministic engine this slice enforces
- Rename (CTAZT5, #331) — `architecture.generated.md`, the `noop` action
- TB persona constraint — "guardrails fire only during agent sessions, never
  blocking their own hand-written commits" — is why the commit-time surface is an
  agent-scoped PreToolUse hook and CI is the backstop for hand commits
- Distinct from `architectureReviewGate` (dev-workflow design-review gate) and
  from `paths.architecture` (the ADR record) — both unrelated to doc freshness

## Personas

- **Technical Builder (TB)** — drives the agent across sessions and commits, and
  owns the health of the project's `main`; harmed when a stale doc lands in a
  commit (or on `main`) and degrades later agent output.

## Vocabulary

Feature-local terms (promote to glossary if they recur):

- **Enforcement** — making doc freshness a gate, not a suggestion: auto-fix at
  agent commit time, hard-fail in CI.
- **Auto-fix-and-stage** — at agent commit time, regenerate the doc via Slice-1
  `selfHeal` and `git add` it into the in-flight commit; never blocks.
- **Would-change action** — a `selfHeal` action that mutates the tree:
  `created`, `healed`, or `regenerated`. The trigger for both surfaces.
- **CI backstop** — `safeword architecture --check`: a dry-run of `selfHeal`
  that writes nothing and exits non-zero on a would-change action.
- **Opt-out** — `architectureDocEnforcement: false` in `.safeword/config.json`;
  disables both surfaces. Absent or `true` ⇒ enabled (default-on).

## Jobs To Be Done

### architecture-staleness-enforcement.TB1 — Commit a fresh doc without thinking about it

**Persona:** Technical Builder (TB)

> When my agent commits after changing the project's structure, I want the
> generated architecture doc brought current and included in that same commit
> automatically — without the commit being blocked and without hand-running a
> command — so my commits never capture a stale picture.

#### architecture-staleness-enforcement.TB1.AC1 — Structural drift is regenerated and staged into the commit

When the committed doc would change (`created`/`healed`/`regenerated`), the
agent commit-time hook regenerates it and stages it into the in-flight commit,
and the commit proceeds (never blocked).

#### architecture-staleness-enforcement.TB1.AC2 — A doc that needs no change is left alone

A fresh (`unchanged`/`noop`) doc is not restaged, and a foreign hand-written doc
(no generator marker) is never touched — and in neither case is the commit
blocked.

#### architecture-staleness-enforcement.TB1.AC3 — Auto-staging never discards unrelated staged changes

Regenerating and staging the doc preserves every other change already staged;
the only file the hook stages is the doc it just regenerated.

### architecture-staleness-enforcement.TB2 — Guarantee main is never stale

**Persona:** Technical Builder (TB)

> When a change is proposed to `main`, I want CI to hard-fail if the committed
> architecture doc is stale — even when the local hook was bypassed or the commit
> was hand-written outside any agent session — so a silently-wrong doc can never
> reach the protected branch.

#### architecture-staleness-enforcement.TB2.AC1 — CI fails when the committed doc would change

The CI check exits non-zero when running the heal would change the tree
(`created`/`healed`/`regenerated`) — i.e. someone committed a stale doc.

#### architecture-staleness-enforcement.TB2.AC2 — CI passes when nothing needs to change

The CI check exits zero for a fresh (`unchanged`), a `noop` (monorepo root), and
a foreign doc — none of which represent a stale safeword-owned doc.

### architecture-staleness-enforcement.TB3 — Turn enforcement off when it doesn't fit

**Persona:** Technical Builder (TB)

> When this enforcement is premature for my project, I want a single committed
> config switch that turns it off on every surface — so neither my agent's
> commits nor CI act on the generated doc.

#### architecture-staleness-enforcement.TB3.AC1 — Opt-out disables commit-time auto-fix

With `architectureDocEnforcement: false`, the agent commit-time hook does not
regenerate or stage the doc, even when it is stale.

#### architecture-staleness-enforcement.TB3.AC2 — Opt-out makes the CI check pass

With `architectureDocEnforcement: false`, the CI check exits zero even on a
stale doc — the deliberate project opt-out is honored on the backstop too.

## Outcomes

- An agent commit made after a structural change lands with the regenerated doc
  staged in it, with no block and no hand-run command (default config).
- `safeword architecture --check` exits non-zero on a stale committed doc and
  zero on a fresh/`noop`/foreign one — the unbypassable `main` backstop.
- Setting `architectureDocEnforcement: false` disables both surfaces.
- Foreign docs and unresolved prose markers stay advisory (never block) —
  enforcement governs only safeword-owned _structure_, never prose.

## Open Questions

- none — threshold map, hard-fail set, config key, and wiring all resolved in
  intake (`/figure-it-out`, see ticket "Resolved design").
