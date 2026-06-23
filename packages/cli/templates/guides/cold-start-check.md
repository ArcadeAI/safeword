# Cold-Start Executability Check

The sharpest test of whether intake captured enough: hand the spec to a fresh
agent that has none of this conversation, and see if it could plan the work from
that alone. It strips the "I already know what they meant from the chat" crutch
on exactly the work where being wrong is most expensive — irreversible,
one-way-door features.

It is **heavyweight** (it spawns a sub-agent), so it is reserved for one-way-door
work and run at most once at intake exit, or on demand. It is **advisory**: it
surfaces gaps, it never blocks. The lightweight every-turn nudge is the readiness
pointer; this is the occasional deep check.

## When it runs

- **Offered at the Intake Exit step** for a feature whose intake brief records a
  one-way-door (or cross-cutting) Reversibility — see the BDD intake flow.
- **On demand**, any time the builder asks for it — explicitly, regardless of the
  reversibility read. Run it even when the auto-offer would not fire (e.g. a
  two-way-door brief) if the builder wants the sufficiency signal independent of
  the trigger.

## How to run it

Spawn one fresh sub-agent with `isolation: worktree` — a clean copy of the repo,
with **no conversation history** handed over. Give it exactly three things and
nothing more:

1. the ticket (`ticket.md`),
2. the spec (`spec.md`),
3. the repo (present in the worktree).

Do **not** pass the conversation — no transcript, no chat history, no summary of
what was said. The conversation is the crutch being removed; passing any of it
defeats the test. The worktree gives the cold agent the codebase (it cannot plan
against a repo it cannot see) while the missing transcript forces the captured
context to stand on its own.

Instruct the cold agent to **attempt to plan the work end-to-end** from those
inputs — design the approach, name the files and behaviors it would touch — and
to report, at each point where the spec forced it to guess at intent or
constraints, what it could not determine.

The cold agent **plans; it does not run a full build**. Insufficiency surfaces
during planning — ambiguous intent, missing constraints — long before a full
implementation would, at a fraction of the cost.

## The verdict

Two-valued:

- **Sufficient** — the cold agent could plan the work end-to-end without guessing
  at intent or constraints. Nothing to add.
- **Insufficient** — the cold agent had to guess; the verdict names a non-empty
  list of **gaps** (each a specific thing it could not determine from the spec +
  repo).

### Rendering the verdict

Present the verdict in **plain language**, with a concrete **next action** — what
is missing and what to do about it — written so a builder who cannot read the
diff can act on it. Avoid internal jargon in the builder-facing summary (no
"sub-agent", no "isolation: worktree" — that is mechanism, not signal).

### Persisting the gaps

Append each named gap to the spec's `## Open Questions` section. **Append** — add
to whatever is already there; preserve the existing questions, never overwrite
them. If the section is empty, add the gaps as its first entries. (Unlike the
replan-on-resume pattern this reuses — which reports in chat only and never edits
the ticket — this check writes to Open Questions **by design**, because that is
the sink the Intake Exit discipline already drains before define-behavior.)

## It never blocks

The check is **advisory**: an insufficient verdict does not block anything. The
**builder decides** whether to proceed, close the gaps first, or `defer:` them.

If the sub-agent **errors or times out**, note it in one line and proceed with the
work — no gaps written, no block. Do not retry in a loop. (Same failure rule as
the replan-on-resume harness.)

## Under YOLO mode

When gates auto-confirm (YOLO, G2E72G), the offer auto-accepts: the check runs,
its gaps are appended to Open Questions, and the auto-decision is recorded in the
work log. Because the auto-confirming Intake Exit treats a non-empty Open
Questions list as resolved, record each auto-appended gap as `defer: <reason>` so
the exit is not silently waved through with unresolved gaps — `defer:` is the sole
reconciliation, surfacing the gap in the audit trail without blocking the
autonomous run.
