# Spec: Audit checks namespace domain docs for emptiness and drift

## Intent

`/audit` reviews codebase health but never looks at the three namespace domain
docs — `personas.md`, `surfaces.md`, `glossary.md` — so they rot silently: a
project ships with empty template scaffold, or a surface/persona gets referenced
in scenarios while its inventory entry is never added. These docs power the BDD
intake flow, so when they drift, every downstream spec references stale ground.
This feature makes `/audit` observe their emptiness and their drift against what
the code actually references, so the reader is told to fix them.

## Intake Brief

- **Requested by:** Repo owner (alex), while auditing skill docs — GitHub issue #1027.
- **Cost of inaction:** Domain docs drift undetected. Concrete live proof: `@surface.safeword-cli` is tagged in 3 `.feature` files today but is absent from `surfaces.md`; nothing surfaces it. Empty docs on a fresh install stay empty because nothing prompts the maintainer to fill them, and BDD intake references degrade.
- **Reversibility:** Two-way door. Pure-prose additions to one skill file (plus its two parity mirrors); no data model, no public API, no migration. Revertible by deleting the added subsection.

## References

- GitHub issue [#1027](https://github.com/ArcadeAI/safeword/issues/1027)
- Design: `/figure-it-out` → Option A (pure-prose skill check, no new CLI code)
- Precedent: `SKILL.md` Section 5 structural-drift reconciliation (ARCHITECTURE.md ↔ `architecture.generated.md`) — "report only, never auto-overwrite prose"
- Structure already validated elsewhere: `health.ts` → `validatePersonas` / `validateGlossary` (this check must not duplicate it)

## Personas

- **Technical Builder (TB)** — runs `/audit` on a real project and relies on it to keep the domain docs that feed BDD intake honest.
- **Safeword Maintainer (SM)** — dogfoods `/audit` in this repo; is the one who hits the live `@surface.safeword-cli` gap.

## Surfaces

Affected:

- Claude Code — primary; `/audit` runs the inline `!`-bash and reads the docs.
- OpenAI Codex — parity mirror `.agents/skills/`; no `!`-bash auto-expansion, so the check degrades to model-reads-and-reasons.
- Cursor — parity mirror `.mdc`.

Unaffected:

- Claude Code on the Web / Codex Cloud / Cursor Cloud Agents — same skill files apply; no cloud-lifecycle-specific behavior in this check.

Each affected surface is covered by the audit skill's parity mirrors, not by
per-surface runtime branches — the behavior is one prose block read identically.

## Vocabulary

- **Surface** — a supported runtime/client/deployment context where behavior must keep working; inventory in `surfaces.md`, referenced by scenarios via `@surface.<slug>` tags (glossary term "Surface" pending — this feature exercises the drift it describes).
- **Domain docs** — this feature's shorthand for the three namespace files `personas.md` / `surfaces.md` / `glossary.md`. Spec-local; not a project glossary term.
- **Drift** — an inventory doc out of sync with what the code/scenarios actually reference (referenced-but-undefined).
- **Emptiness** — a domain doc containing only template scaffold (`# Heading` + HTML comment), zero `##` entries parsed.

## Jobs To Be Done

### audit-domain-docs.TB1 — Catch domain-doc rot during audit

**Persona:** Technical Builder (TB)

> When I run `/audit` on my project, I want it to tell me when a domain doc is
> empty or has drifted from what my code references, so I can keep the personas,
> surfaces, and glossary that power BDD intake accurate instead of discovering
> the rot months later inside a broken spec.

#### audit-domain-docs.TB1.R1 — A surface referenced by a scenario tag but absent from the surfaces inventory is reported as a drift error

#### audit-domain-docs.TB1.R2 — A persona named in a comment-stripped spec `**Persona:**` line but absent from the personas inventory is reported as a drift error (feature lineage-tag source dropped — ticket-ID noise)

#### audit-domain-docs.TB1.R3 — A domain doc containing only template scaffold (zero entries) is reported as empty, with an offer to fill it from its template

#### audit-domain-docs.TB1.R4 — Human-curated content (glossary terms, persona/surface descriptions) is never reported as an error; content staleness is advisory only

## Rave Moment

skip: table-stakes — a documentation-freshness check is a quiet correctness
guard, not a shareable peak. The value is the absence of silent rot, which
nobody screenshots.

## Outcomes

- Running `/audit` on this repo today reports the `@surface.safeword-cli` gap as an error.
- Running `/audit` on a fresh install (empty domain docs) reports each empty doc and offers to fill it from its template.
- Running `/audit` on a fully-populated, in-sync repo produces zero domain-doc findings.
- `/audit` never rewrites a domain doc as part of the audit pass (read-only) and never emits an error for human-curated content on a hunch.

## Open Questions

<!-- none open -->
