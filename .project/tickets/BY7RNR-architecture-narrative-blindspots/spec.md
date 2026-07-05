# Spec: Architecture narrative reconciliation: honor paths.architecture + surface pre-existing drift

## Intent

Make the AXRC4D narrative-reconciliation loop actually reach hosts: the done-gate
nudge and architecture prompts resolve the human narrative via `paths.architecture`
(root `ARCHITECTURE.md` fallback) instead of a hardcoded root filename, and
`safeword architecture` runs surface pre-existing drift — generated packages the
narrative never mentions — instead of only go-forward fingerprint movement.

## Intake Brief

- **Requested by:** ArcadeAI/monorepo maintainer (GitHub #848), after a real drift incident: the generated root map listed six apps — two whole product clusters — absent from the human architecture narrative, and no safeword surface flagged it; a human found it by hand-diffing the two files.
- **Cost of inaction:** In any host whose narrative doesn't live at root `ARCHITECTURE.md`, the AXRC4D reconcile nudge silently never fires — and drift that predates the safeword install (the common case in mature hosts) is never surfaced at all. Agents navigate with a map missing whole subsystems, the exact failure the architecture subsystem exists to prevent.
- **Reversibility:** Two-way door. Advisory-only output plus a config-resolution tweak; no data model, no public API, no migration. Reverting is deleting an advisory and a fallback chain.

## References

- GitHub #848 (this ticket), #559/AXRC4D (the nudge being fixed), #843/#844 (generator quality in the same host — out of scope here)
- Ticket K4BWTQ — `paths.architecture` may be a file or an ADR directory (`listArchitectureRecords`)
- Ticket K7N2QM — configured-paths design rationale
- Ticket UWP4XK — `warnUnreadableWorkspaces`: the advisory-beside-the-command precedent this follows
- P58R22 — differential parity-test pattern for standalone hook copies

## Personas

- Technical Builder (TB) — runs safeword on a real (often mature, monorepo) project; owns the architecture narrative.

## Surfaces

Affected:

- Claude Code — skip: proven at the shared hook-lib level; the done-gate nudge helper (`architecture-document-nudge.ts`) is invoked identically by all three stop hooks, and unit/differential tests cover it harness-independently
- OpenAI Codex — skip: same shared-helper reasoning
- Cursor — skip: same shared-helper reasoning

Unaffected:

- Claude Code on the Web / OpenAI Codex Cloud / Cursor Cloud Agents — the CLI advisory and hook helper are runtime-agnostic; cloud vs local changes nothing about file resolution.

## Vocabulary

- **Narrative** — the human-authored architecture document (root `ARCHITECTURE.md` or the `paths.architecture` target, which may be a single file or a directory of decision records); contrast with the machine-owned `architecture.generated.md`.
- **Mentioned** — a generated package counts as mentioned when its full name or its scoped tail (`@scope/pkg` → `pkg`) appears case-insensitively at a word boundary anywhere in the narrative's text. Deliberately generous: the advisory prefers under-reporting to nagging; `/audit` remains the authoritative reconciliation pass.

## Jobs To Be Done

### architecture-narrative-blindspots.TB1 — Reconcile nudges reach the narrative where it actually lives

**Persona:** Technical Builder (TB)

> When my architecture narrative lives somewhere other than root `ARCHITECTURE.md`
> and I've pointed `paths.architecture` at it, I want the done-gate reconcile nudge
> and the architecture prompts to resolve that configured location, so tickets that
> move the architecture shape still prompt me to reconcile the narrative instead of
> silently assuming I have none.

#### architecture-narrative-blindspots.TB1.AC1 — Configured narrative location is honored

With `paths.architecture` set to a non-root path (a file, or an ADR directory per
K4BWTQ), a ticket that moves the generated shape fingerprint produces the done-gate
advisory — where today it silently never fires.

#### architecture-narrative-blindspots.TB1.AC2 — Root fallback keeps existing hosts working

With no `paths.architecture` configured, a host with a root `ARCHITECTURE.md` gets
exactly the behavior it has today: nudge on fingerprint movement, silence when
nothing moved or when no narrative exists anywhere.

#### architecture-narrative-blindspots.TB1.AC3 — The advisory names the resolved narrative

The nudge text names the narrative document it's asking the builder to reconcile
(the configured path when set), so the builder knows which doc to open — not a
hardcoded `ARCHITECTURE.md` that may not exist.

#### architecture-narrative-blindspots.TB1.AC4 — Architecture prompts direct agents to the configured narrative

The installed architecture prompt and the audit skill's structural-drift check tell
the agent to resolve the narrative via `paths.architecture` (root `ARCHITECTURE.md`
fallback) instead of hardcoding the root filename.

### architecture-narrative-blindspots.TB2 — Pre-existing drift is surfaced, not just go-forward drift

**Persona:** Technical Builder (TB)

> When safeword's generated architecture map lists packages my narrative never
> mentions — drift that predates the safeword install, so no ticket ever "moved"
> the shape — I want `safeword architecture` runs to name the missing packages,
> so agents stop navigating with a map missing whole subsystems and I know to
> reconcile via `/audit`.

#### architecture-narrative-blindspots.TB2.AC1 — Missing packages are named

When a monorepo's generated root index lists packages under `## Packages` that the
narrative never mentions, a `safeword architecture` run prints an advisory naming
them (capped, with an "and N more" tail) and pointing at `/audit` — the check that
would have caught all six apps in the incident.

#### architecture-narrative-blindspots.TB2.AC2 — Reconciled narrative means silence

When every generated package is mentioned in the narrative — or no narrative exists
at the resolved location — the run emits no drift advisory. The advisory self-clears
once the human reconciles.

#### architecture-narrative-blindspots.TB2.AC3 — Advisory only, never an exit-code change

The drift advisory never alters any `safeword architecture` mode's exit code:
`--check` still fails only on generated-doc staleness; default and `--stage` runs
still succeed. The narrative is human-owned; only a person can fix it (AXRC4D
ruling stands).

## Rave Moment

### architecture-narrative-blindspots — the map catches the missing clusters itself

- **Moment:** A session opens and safeword says, unprompted: "Architecture narrative is missing 6 generated packages: chat, experience-api, identity-ui, condex, condex-admin, goembed — run `/audit` to reconcile."
- **Beats:** The incident itself — docs rot silently until a human happens to hand-diff the generated map against the narrative (that's how #848 was found).
- **They'd say:** "safeword caught that our architecture doc was missing two whole product clusters before any agent got lost."

(Grounded in the #848 incident report rather than priors — the human fix commit `ddd55f8` in the host repo is exactly what this advisory would have prompted automatically.)

## Outcomes

- A host with `paths.architecture` configured gets the done-gate reconcile nudge on shape-moving tickets; hosts with root `ARCHITECTURE.md` and no config behave exactly as before.
- Every `safeword architecture` run (including the session-start heal) names generated packages missing from the narrative, and goes quiet once the narrative is reconciled.
- No new blocking behavior anywhere; exit codes unchanged in every mode.

## Open Questions

_None — resolution chain and advisory surface settled by figure-it-out; edge-case calls recorded in Design notes._
