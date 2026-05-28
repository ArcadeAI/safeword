# YR6C49 — Test Definitions

Behavior specifications for the project-glossary feature
(`.safeword-project/glossary.md` + parser, validator, configured path,
scaffold, `safeword check` integration, lookup API, Phase 0 hook).
Derived from `dimensions.md`. Each scenario is Atomic / Observable /
Deterministic / Independent (AODI).

## Rule: Parser handles canonical entry shapes

> Glossary entries are `## Term` blocks. Required field is
> `**Definition:**`; the rest are optional and parsed if present. The
> parser is lenient by design — unknown `**Field:**` lines are tolerated
> for forward-compat, and the arcade-prototype `**Used in**:`
> (colon-outside-bold) variant parses identically to `**Used in:**`.

### Scenario: Minimal entry parses to one term with Definition

Given a glossary file containing one `## Tool` block with a `**Definition:**` line and nothing else
When `parseGlossary(content)` is called
Then it returns one entry with `name: 'Tool'` and `definition: '<the definition text>'`
And all optional fields are absent

- [x] RED 12d52785
- [x] GREEN 83aeabca
- [x] REFACTOR skip: walking-skeleton minimum, no duplication to extract yet

### Scenario: Rich entry parses with all optional fields populated

Given a glossary file containing one `## Tool` block with `**Definition:**`, `**Used in:**`, `**Example:**`, and `**Do not confuse with:**` lines
When `parseGlossary(content)` is called
Then it returns one entry with all four fields populated and `name: 'Tool'`

- [x] RED b240b696
- [x] GREEN 9073c0f0
- [x] REFACTOR skip: FIELD_PROPERTY_MAP extracted in GREEN itself

### Scenario: Aliases line parses into list

Given a glossary file containing one `## Tool` block with `**Definition:**` and `**Aliases:** Function, Capability`
When `parseGlossary(content)` is called
Then the returned entry has `aliases: ['Function', 'Capability']`

- [x] RED 74651b8e
- [x] GREEN 743456d9
- [x] REFACTOR skip: parseAliasLine + applyLineToEntry extracted in GREEN to satisfy complexity ceiling

### Scenario: Unknown `**Field:**` is tolerated

Given a glossary file containing one `## Tool` block with `**Definition:**` and an unknown `**SomeFutureField:**` line
When `parseGlossary(content)` is called
Then it returns the entry without error
And the unknown field is silently ignored (not surfaced as parsed content)

- [x] RED skip: behavior already implemented by R1.2 GREEN (FIELD_PROPERTY_MAP returns undefined on unknown prefix, applyLineToEntry no-ops); test added as regression-only at commit 10ebb450
- [x] GREEN 10ebb450
- [x] REFACTOR skip: no new code path

### Scenario: Arcade `**Used in**:` colon-outside variant parses identically

Given a glossary file containing one `## Tool` block with `**Used in**: Engine, MCP servers` (colon outside the bold)
When `parseGlossary(content)` is called
Then the returned entry has `usedIn: 'Engine, MCP servers'` (same as the colon-inside variant)

- [x] RED 638618b1
- [x] GREEN 818b9e42
- [x] REFACTOR skip: normalizeFieldColon helper is the minimal viable shape

### Scenario: Multi-line field value accumulates continuation lines

Given a glossary file with a `## Tool` block whose `**Definition:**` text wraps across three lines, followed by a blank line and a `**Used in:**` field
When `parseGlossary(content)` is called
Then `definition` contains all three lines joined with single spaces
And `usedIn` is captured separately (the blank line terminated the Definition accumulation)

> _(Surfaced by `/quality-review` running the parser against arcade's
> real `.project/glossary.md` — its definitions wrap across lines.
> Single-line capture left `definition` truncated. Continuation rule:
> append non-blank lines to the active field until a blank line, a new
> `**Field:**`, or a `##` header.)_

- [x] RED 821bd606
- [x] GREEN 66cdfd89
- [x] REFACTOR skip: consumeBodyLine + LineOutcome union extracted in GREEN to satisfy complexity ceiling; verified against arcade fixture (full definition captured, 7 entries, 0 errors)

## Rule: Parser skips non-term markdown content

> Mirrors the persona-parser skip-mask semantics. Fenced code blocks and
> block HTML comments are skipped entirely; inline HTML comments on
> header lines are stripped before name extraction. Without these
> guards, README examples and commented-out templates corrupt the
> parse.

### Scenario: Header inside fenced code block is not parsed as a term

Given a glossary file containing a triple-backtick code fence wrapping `## Example`
When `parseGlossary(content)` is called
Then the returned entries do not include `Example`

- [x] RED 530ac7de
- [x] GREEN 67a4f87d
- [x] REFACTOR skip: computeSkipMask mirrors personas pattern; extending in R2.2 GREEN

### Scenario: Header inside HTML comment block is not parsed as a term

Given a glossary file with a block `<!-- ... ## CommentedTerm ... -->`
When `parseGlossary(content)` is called
Then the returned entries do not include `CommentedTerm`

- [x] RED 91e44563
- [x] GREEN 960e8765
- [x] REFACTOR skip: extension of existing computeSkipMask, no new structure

### Scenario: Inline `<!-- ... -->` on header line is stripped from name

Given a glossary file with `## Tool <!-- legacy note -->`
When `parseGlossary(content)` is called
Then the returned entry has `name: 'Tool'` (no comment text in name)

- [x] RED df548ef8
- [x] GREEN d60dcb4f
- [x] REFACTOR skip: stripInlineComments mirrors personas.ts:123 pattern

## Rule: Structural validator catches malformed glossaries

> `validateGlossary` returns a list of `{ line, message }` errors with
> 1-indexed line numbers. Required: every entry has a non-empty name
> and a `**Definition:**` line. Uniqueness: no duplicate term names, no
> duplicate aliases across terms. Referential: aliases must resolve to
> a declared term.

### Scenario: Missing Definition produces an error

Given a glossary file with a `## Tool` block that has no `**Definition:**` line
When `validateGlossary(parsed)` is called
Then the errors include one with the line of the `## Tool` header and message mentioning "missing Definition"

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Duplicate term name produces errors pointing at both lines

Given a glossary file with two `## Tool` blocks
When `validateGlossary(parsed)` is called
Then the errors include two entries (one per duplicate) referencing each other's line numbers

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Duplicate alias across terms produces errors pointing at both lines

Given a glossary file with `## Tool` having `**Aliases:** Function` and `## Capability` having `**Aliases:** Function`
When `validateGlossary(parsed)` is called
Then the errors include two entries (one per duplicate alias) referencing each other's line numbers

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Alias that shadows an existing term name produces an error

Given a glossary file with `## Tool` having `**Aliases:** Widget` and a separate `## Widget` term block defined
When `validateGlossary(parsed)` is called
Then the errors include one referencing the alias's entry line with message mentioning "shadows term"

> _(**Scenario corrected during implementation.** The original R3.4
> ("alias referencing a non-existent term → error") was semantically
> backwards — an alias is an alternative name and by definition need not
> have its own block, so requiring one would defeat aliases. The real
> referential hazard the dimension table meant is the inverse: an alias
> that collides with a declared term name makes lookup ambiguous (is
> "Widget" the Tool-alias or the Widget-term?). This matches the
> decomposition.md owned decision "alias collision with another term's
> canonical → error; resolver requires string → exactly-one-term."
> Alias-duplicates-alias is already covered by R3.3.)_

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Empty term name produces an error

Given a glossary file with `##` (header with no name) followed by a `**Definition:**` line
When `validateGlossary(parsed)` is called
Then the errors include one with the header line and message mentioning "missing term name"

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Configured-path resolution inherits K7N2QM pattern

> `validateGlossaryReference(cwd, input)` resolves via
> `resolveConfiguredPath(cwd, 'glossary', '.safeword-project/glossary.md')`.
> Returns `{ status: 'unknown' }` on any missing-file case (default OR
> configured); never throws. Loud failure on configured-but-missing
> lives at `safeword check`, not here. Mirrors `validatePersonaReference`
> verbatim.

### Scenario: Override unset reads default location

Given `.safeword/config.json` has no `paths.glossary` entry
And `.safeword-project/glossary.md` exists with a term `Tool`
When `validateGlossaryReference(cwd, 'Tool')` is called
Then it returns `{ status: 'valid', match: { name: 'Tool', ... } }`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Relative override resolves project-root-relative

Given `.safeword/config.json` has `paths.glossary: "docs/glossary.md"`
And `docs/glossary.md` exists with a term `Tool`
And `.safeword-project/glossary.md` does not exist
When `validateGlossaryReference(cwd, 'Tool')` is called
Then it returns `{ status: 'valid', match: { name: 'Tool', ... } }`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Absolute override is used verbatim

Given `.safeword/config.json` has `paths.glossary` set to an absolute path outside the project tree
And the absolute path points to a file with a term `Tool`
When `validateGlossaryReference(cwd, 'Tool')` is called
Then it returns `{ status: 'valid', match: { name: 'Tool', ... } }`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Empty-string override falls back to default

Given `.safeword/config.json` has `paths.glossary: ""`
And `.safeword-project/glossary.md` exists with a term `Tool`
When `validateGlossaryReference(cwd, 'Tool')` is called
Then it returns `{ status: 'valid', match: { name: 'Tool', ... } }`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Configured-but-missing returns unknown without throwing

Given `.safeword/config.json` has `paths.glossary: "docs/glossary.md"`
And `docs/glossary.md` does not exist
When `validateGlossaryReference(cwd, 'Tool')` is called
Then it returns `{ status: 'unknown' }`
And it does not throw

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: `safeword setup` scaffolds glossary, respects schema-ownership

> `setup` is idempotent: scaffolds the default file when absent, never
> overwrites existing content. When `paths.glossary` is configured, the
> `configKey` gate on the `managedFiles` entry uniformly suppresses the
> default scaffold (mirrors K7N2QM R3.2 personas behavior).

### Scenario: Glossary absent → scaffolded from template

Given `.safeword-project/glossary.md` does not exist
And `.safeword/config.json` has no `paths.glossary` entry
When `safeword setup` runs
Then `.safeword-project/glossary.md` exists with content matching the template

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Glossary already present → setup does not overwrite

Given `.safeword-project/glossary.md` exists with user content
When `safeword setup` runs a second time
Then `.safeword-project/glossary.md` content is unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Override configured → reconcile skips default scaffold

Given `.safeword/config.json` has `paths.glossary: "docs/glossary.md"`
And `.safeword-project/glossary.md` does not exist
When `safeword setup` runs
Then `.safeword-project/glossary.md` is NOT created
And `docs/glossary.md` is NOT created either (user owns the override path)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: `safeword check` reports glossary health

> Three loud signals: malformed file produces line-numbered errors with
> non-zero exit; configured-but-missing prints
> `glossary-path: <configured>: file not found` with non-zero exit;
> override configured AND legacy default file still present emits a
> zero-exit advisory (migration-trap warning, mirrors K7N2QM R2.6).

### Scenario: Malformed file → line-numbered errors and non-zero exit

Given `.safeword-project/glossary.md` exists with two duplicate `## Tool` blocks
When `safeword check` runs
Then stderr contains both line numbers and the message "duplicate term"
And the exit code is non-zero

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Configured-but-missing → loud non-zero exit

Given `.safeword/config.json` has `paths.glossary: "docs/glossary.md"`
And `docs/glossary.md` does not exist
When `safeword check` runs
Then stderr contains `glossary-path: docs/glossary.md: file not found`
And the exit code is non-zero

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Override set AND legacy default present → zero-exit advisory

Given `.safeword/config.json` has `paths.glossary: "docs/glossary.md"`
And `docs/glossary.md` exists and is well-formed
And `.safeword-project/glossary.md` also exists (legacy default)
When `safeword check` runs
Then stderr (or stdout) contains an advisory naming `.safeword-project/glossary.md` as orphaned
And the exit code is zero

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Lookup API supports agent reference resolution

> `lookupGlossaryReference(terms, input)` is pure (no I/O); takes a
> resolved-term list and an input string; returns
> `{ status: 'valid', match }` on exact term, alias match, or
> `{ status: 'unknown', suggestion? }` with a case-mismatch suggestion
> when only casing differs. Powers the agent's in-context glossary use
> at Phase 0.

### Scenario: Exact term match returns valid

Given a parsed glossary with term `Tool`
When `lookupGlossaryReference(terms, 'Tool')` is called
Then it returns `{ status: 'valid', match: { name: 'Tool', ... } }`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Alias match resolves to canonical term

Given a parsed glossary with term `Tool` having aliases `['Function', 'Capability']`
When `lookupGlossaryReference(terms, 'Function')` is called
Then it returns `{ status: 'valid', match: { name: 'Tool', ... } }`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Case-mismatch on name returns suggestion

Given a parsed glossary with term `Tool`
When `lookupGlossaryReference(terms, 'tool')` is called
Then it returns `{ status: 'unknown', suggestion: 'Tool' }`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unknown reference returns unknown without suggestion

Given a parsed glossary with terms `Tool` and `Toolkit`
When `lookupGlossaryReference(terms, 'Widget')` is called
Then it returns `{ status: 'unknown' }` with no `suggestion`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: KD4BYF + DISCOVERY.md integration

> Two end-to-end assertions: (1) arcade's existing battle-tested glossary
> parses unchanged under the canonical reader (validates the X-C schema
> decision empirically), (2) DISCOVERY.md Phase 0 documents the
> glossary-loading sub-step parallel to the existing persona-loading
> block so the agent actually reads the file at intake start.

### Scenario: Arcade glossary parses with zero structural errors

Given a fixture copy of `/Users/alex/Projects/arcade-monorepo/.project/glossary.md` (7 rich-format terms, mixed colon-inside/colon-outside variants)
When `parseGlossary(content)` and `validateGlossary(parsed)` are called
Then `parseGlossary` returns 7 entries
And `validateGlossary` returns zero errors

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: DISCOVERY.md documents glossary-loading sub-step

Given the on-disk `.claude/skills/bdd/DISCOVERY.md` and its canonical template `packages/cli/templates/skills/bdd/DISCOVERY.md`
When the file contents are inspected
Then both contain a "Load project glossary" sub-step structurally parallel to the existing "Load project personas" block
And the empty-file soft-prompt wording mirrors the persona equivalent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
