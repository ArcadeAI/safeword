# Y2HCNJ — Test Definitions

Behavior specifications for JTBD-as-Phase-0-artifact (new per-ticket
`spec.md`, type-aware scaffold, JTBD-section parser, lightweight
gate-level persona resolution, intake-exit JTBD gate, DISCOVERY.md /
SAFEWORD.md doc integration). Derived from `dimensions.md`. Each
scenario is Atomic / Observable / Deterministic / Independent (AODI).

Function shapes referenced below (firm up in decomposition):

- `createTicket(cwd, minter, { type })` — existing; extended to scaffold spec.md for features.
- `parseJtbdSection(specContent)` → `{ entries: { persona, lineNumber }[]; skip: string | null }` (new, `hooks/lib/jtbd.ts`).
- `knownPersonaRefs(personasContent)` → `Set<string>` of names + codes (new, `hooks/lib/jtbd.ts`).
- `evaluateJtbdGate(specContent, personasContent)` → `{ ok: true } | { ok: false; reason: string }` (new, `hooks/lib/jtbd.ts`; composes the two above).

## Rule: `safeword ticket new` scaffolds spec.md for features only

> D4 — features only. `createTicket` writes `spec.md` next to `ticket.md`
> when `type === 'feature'`. `task`, `patch`, and the defaulted type
> (which falls back to `task`) get no `spec.md`. The scaffold is the
> `spec-template.md` content; it is never overwritten if already present.

### Scenario: Feature ticket scaffolds spec.md alongside ticket.md

Given a fresh tickets directory
When `createTicket(cwd, minter, { slug: 'oauth-flow', type: 'feature' })` runs
Then `spec.md` exists in the new ticket folder next to `ticket.md`

- [x] RED 44e57878
- [x] GREEN 44e57878
- [x] REFACTOR skip: no duplication — renderSpecMarkdown + type branch are minimal

### Scenario: Task ticket does not scaffold spec.md

Given a fresh tickets directory
When `createTicket(cwd, minter, { slug: 'add-flag', type: 'task' })` runs
Then `ticket.md` exists in the new ticket folder
And `spec.md` does NOT exist in that folder

- [x] RED 44e57878
- [x] GREEN 44e57878
- [x] REFACTOR skip: no duplication — renderSpecMarkdown + type branch are minimal

### Scenario: Patch ticket does not scaffold spec.md

Given a fresh tickets directory
When `createTicket(cwd, minter, { slug: 'fix-typo', type: 'patch' })` runs
Then `spec.md` does NOT exist in the new ticket folder

- [x] RED 44e57878
- [x] GREEN 44e57878
- [x] REFACTOR skip: no duplication — renderSpecMarkdown + type branch are minimal

### Scenario: Omitted type defaults to task and scaffolds no spec.md

Given a fresh tickets directory
When `createTicket(cwd, minter, { slug: 'misc' })` runs with no `type`
Then `ticket.md` frontmatter has `type: task`
And `spec.md` does NOT exist in the new ticket folder

- [x] RED 44e57878
- [x] GREEN 44e57878
- [x] REFACTOR skip: no duplication — renderSpecMarkdown + type branch are minimal

### Scenario: Scaffolded spec.md content equals the template with the title substituted

Given a fresh tickets directory
When `createTicket(cwd, minter, { slug: 'oauth-flow', type: 'feature', title: 'OAuth credential rotation' })` runs
Then the written `spec.md` equals `spec-template.md` with `{title}` replaced by the ticket title (other guidance intact for the agent to fill)

- [x] RED 44e57878
- [x] GREEN 44e57878
- [x] REFACTOR skip: no duplication — renderSpecMarkdown + type branch are minimal

## Rule: ticket.md template shape is type-aware

> D2 — `**Why:**` is dropped for features (motivation lives in
> `spec.md`'s `## Intent`) and replaced by a `**See:** spec.md` pointer.
> `task` and `patch` have no spec.md, so they keep `**Goal:** + **Why:**`
> unchanged.

### Scenario: Feature ticket.md has Goal + See pointer and no Why

Given a feature ticket rendered by `createTicket`
When the `ticket.md` body is inspected
Then it contains a `**Goal:**` line and a `**See:**` pointer to `spec.md`
And it does NOT contain a `**Why:**` line

- [x] RED 44e57878
- [x] GREEN 44e57878
- [x] REFACTOR skip: no duplication — renderSpecMarkdown + type branch are minimal

### Scenario: Task ticket.md keeps Goal + Why and has no spec pointer

Given a task ticket rendered by `createTicket`
When the `ticket.md` body is inspected
Then it contains both a `**Goal:**` and a `**Why:**` line
And it does NOT contain a `**See:**` spec.md pointer

- [x] RED 44e57878
- [x] GREEN 44e57878
- [x] REFACTOR skip: no duplication — renderSpecMarkdown + type branch are minimal

### Scenario: Patch ticket.md keeps Goal + Why and has no spec pointer

Given a patch ticket rendered by `createTicket`
When the `ticket.md` body is inspected
Then it contains both a `**Goal:**` and a `**Why:**` line
And it does NOT contain a `**See:**` spec.md pointer

- [x] RED 44e57878
- [x] GREEN 44e57878
- [x] REFACTOR skip: no duplication — renderSpecMarkdown + type branch are minimal

## Rule: spec-template.md is well-formed

> The template carries all six section headers in canonical order and a
> worked JTBD example demonstrating the `When I…, I want…, so I can…`
> form with a JTBD-level id.

### Scenario: Template has all six section headers in order

Given the file `packages/cli/templates/spec-template.md`
When its headers are extracted in document order
Then they are exactly: Intent, References, Personas, Vocabulary, Jobs To Be Done, Outcomes

- [x] RED 44e57878
- [x] GREEN 44e57878
- [x] REFACTOR skip: static template-content assertion, nothing to refactor

### Scenario: Template's Jobs To Be Done section carries an HTML-commented worked example

Given the file `packages/cli/templates/spec-template.md`
When the `## Jobs To Be Done` section is inspected
Then it contains, inside an HTML comment, a worked JTBD with a `**Persona:**` line and a statement matching the `When I …, I want …, so I can …` form
And the example heading shows a `<slug>.<persona-code><n>` id

> _(The example is commented so a freshly scaffolded spec.md parses to
> zero JTBD entries — the agent fills real ones during Phase 0. Mirrors
> personas-template.md / glossary-template.md, whose examples live in
> HTML comments. Without this, the scaffold ships a fake JTBD that would
> falsely pass or fail the gate.)_

- [x] RED 44e57878
- [x] GREEN 44e57878
- [x] REFACTOR skip: static template-content assertion, nothing to refactor

## Rule: JTBD-section parser extracts entries and skip declaration

> `parseJtbdSection(specContent)` reads only the `## Jobs To Be Done`
> section. Each entry is keyed by its `**Persona:** <ref>` line; the
> parser captures the ref and its 1-indexed line number. A
> `skip: <reason>` line anywhere in the section is captured separately.
> The parser is pure (no I/O) and lenient on surrounding prose.

### Scenario: Single entry parses to one JTBD with its persona ref

Given a spec.md whose Jobs To Be Done section has one `### …` heading and a `**Persona:** Platform Operator (PO)` line
When `parseJtbdSection(content)` is called
Then `entries` has length 1 with `persona: 'Platform Operator (PO)'`
And `skip` is `null`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Multiple entries all parse

Given a spec.md whose Jobs To Be Done section has two entries with distinct `**Persona:**` lines
When `parseJtbdSection(content)` is called
Then `entries` has length 2

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Header-only section parses to zero entries

Given a spec.md with a `## Jobs To Be Done` header and no entries beneath it
When `parseJtbdSection(content)` is called
Then `entries` is empty
And `skip` is `null`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: skip declaration is captured

Given a spec.md whose Jobs To Be Done section contains `skip: no user-facing personas for this internal refactor`
When `parseJtbdSection(content)` is called
Then `skip` equals `no user-facing personas for this internal refactor`
And `entries` is empty

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Entry with empty Persona value yields an empty ref

Given a spec.md whose Jobs To Be Done section has an entry with a `**Persona:**` line and no value after it
When `parseJtbdSection(content)` is called
Then `entries` has length 1 with an empty-string `persona`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Entries outside the Jobs To Be Done section are ignored

Given a spec.md with a `**Persona:**` line under the `## Personas` section but none under `## Jobs To Be Done`
When `parseJtbdSection(content)` is called
Then `entries` is empty

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: HTML-commented JTBD in the section is not parsed as an entry

Given a spec.md whose Jobs To Be Done section contains only a worked example wrapped in an `<!-- … -->` block (the scaffolded template state)
When `parseJtbdSection(content)` is called
Then `entries` is empty
And `skip` is `null`

> _(The freshly scaffolded spec.md must parse to zero JTBDs so the gate
> forces real authoring. Mirrors the persona/glossary skip-mask
> semantics — block HTML comments are skipped entirely.)_

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Gate-level persona resolution is lightweight membership

> `knownPersonaRefs(personasContent)` returns the set of persona names
> and explicit codes declared by `## Name (CODE)` headers. Resolution is
> exact-string membership — case-suggestion and the richer
> `validatePersonaReference` contract stay in the agent/authoring path.
> Missing personas.md degrades to an empty set (no throw).

### Scenario: Persona name resolves against personas.md

Given personas.md with a header `## Platform Operator (PO)`
When `knownPersonaRefs(content)` is called
Then the returned set contains `Platform Operator (PO)` and `Platform Operator` and `PO`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reference absent from personas.md does not resolve

Given personas.md declaring only `## Platform Operator (PO)`
When membership of `End User` is tested against `knownPersonaRefs(content)`
Then it is not a member

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing personas.md degrades to empty refs without throwing

Given a `knownPersonaRefs('')` call (personas.md unreadable / empty)
When it is evaluated
Then it returns an empty set
And it does not throw

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: `evaluateJtbdGate` composes parse + resolution into a decision

> `evaluateJtbdGate(specContent, personasContent)` returns
> `{ ok: true }` when there is ≥1 JTBD entry whose persona resolves, OR a
> non-empty `skip:` reason. It returns `{ ok: false, reason }` on zero
> entries, an unresolved persona ref, or an empty/whitespace skip reason.
> Mirrors the dimensions.md escape-valve gate, plus the unresolved-persona
> branch unique to JTBDs.

### Scenario: One JTBD with a resolving persona passes

Given a spec with one JTBD entry `**Persona:** Platform Operator (PO)` and personas.md declaring `## Platform Operator (PO)`
When `evaluateJtbdGate(spec, personas)` is called
Then it returns `{ ok: true }`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Non-empty skip reason passes even with zero JTBDs

Given a spec whose Jobs To Be Done section is `skip: internal plumbing, no persona-facing job`
When `evaluateJtbdGate(spec, personas)` is called
Then it returns `{ ok: true }`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Zero JTBD entries (no skip) is denied

Given a spec whose Jobs To Be Done section is empty and has no skip line
When `evaluateJtbdGate(spec, personas)` is called
Then it returns `{ ok: false }` with a reason mentioning a missing JTBD

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: JTBD naming a persona absent from personas.md is denied

Given a spec with one JTBD entry `**Persona:** Ghost Persona` and personas.md that does not declare it
When `evaluateJtbdGate(spec, personas)` is called
Then it returns `{ ok: false }` with a reason naming the unresolved persona

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: skip with an empty reason is denied

Given a spec whose Jobs To Be Done section is `skip:` with only whitespace after the colon
When `evaluateJtbdGate(spec, personas)` is called
Then it returns `{ ok: false }` with a reason about the empty skip reason

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Intake-exit hook applies the JTBD gate only when spec.md is present

> The pre-tool-quality hook gates `test-definitions.md` creation. When the
> ticket folder has a `spec.md` (D5 new-flow routing), the hook also runs
> `evaluateJtbdGate` and denies on failure. When `spec.md` is absent
> (grandfathered in-flight ticket, or task/patch), the JTBD gate is
> skipped entirely — the existing scope/phase/dimensions gates are
> unchanged.

### Scenario: Creating test-definitions.md is denied when spec.md has no JTBD

Given a feature ticket folder with complete ticket.md frontmatter (phase past intake, dimensions.md present) and a spec.md whose Jobs To Be Done section is empty
When the hook evaluates a Write of `test-definitions.md` in that folder
Then the hook denies the write with a JTBD-gate message

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Creating test-definitions.md is allowed when spec.md has a resolving JTBD

Given a feature ticket folder with complete prerequisites and a spec.md with one JTBD whose persona resolves against personas.md
When the hook evaluates a Write of `test-definitions.md` in that folder
Then the hook allows the write

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: JTBD gate is skipped when spec.md is absent (grandfathered ticket)

Given a feature ticket folder with complete prerequisites and NO spec.md
When the hook evaluates a Write of `test-definitions.md` in that folder
Then the hook does not raise any JTBD-gate denial (old-flow routing)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Phase 0 docs document the JTBD sub-step

> The JTBD authoring sub-step is added to `DISCOVERY.md` after "Load
> project glossary" and before "Understanding", in both the on-disk skill
> copy and its canonical template (template-sync). `SAFEWORD.md` (template
>
> - dogfood copy) mentions the JTBD sub-step in the Clarify/Phase-0 text.

### Scenario: DISCOVERY.md and its template both carry the JTBD sub-step

Given `.claude/skills/bdd/DISCOVERY.md` and `packages/cli/templates/skills/bdd/DISCOVERY.md`
When both files are inspected
Then both contain a JTBD authoring sub-step positioned after "Load project glossary" and before "Understanding"
And both reference the one-persona-per-JTBD rule and the pause-and-confirm step

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: SAFEWORD.md template and dogfood copy mention the JTBD sub-step

Given `packages/cli/templates/SAFEWORD.md` and `.safeword/SAFEWORD.md`
When both files are inspected
Then both mention the JTBD sub-step within the Clarify / Phase 0 description

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] REFACTOR
