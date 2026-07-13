# Impl Plan: Audit checks namespace domain docs for emptiness and drift

**Status:** planned

## Approach

**Riskiest assumption:** the reference-extraction can distinguish a *real reference* from an incidental string — a slug/code that lives only in prose, or inside an HTML-commented scaffold example, must not fire drift. The plan-review proved the naive versions break: a `##`-count counts commented example headings (every scaffold has them), and feature lineage tags carry ticket-IDs (`MGWZ4P`, `UWP4XK`) indistinguishable from persona codes. **Cheapest proof:** the guard scenarios — R1 "prose-only mention", R2 "commented-out spec example", R3 "verbatim scaffold reported empty" — run the extracted bash against tiny fixtures and assert the expected presence/absence. They fail early while the block is small.

**Shape:** one deterministic `bash` block added to `/audit` SKILL.md Section 5 as a new subsection "Namespace domain docs", mirroring the Section 3 W006 learning-file loop. No new CLI code. The block:

1. **Namespace root:** `NS_ROOT="$(bun $PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts "$PROJECT_DIR" 2>/dev/null)"`, then **fall back whenever `[ -d "$NS_ROOT" ]` is false** (covers both the resolver-absent case and the fake-`bun`-echo case) to `$PROJECT_DIR/.project`, else `$PROJECT_DIR/.safeword-project`. Features dir = `paths.features` or default `features/`.
2. **Emptiness (W008) — comment-aware:** strip `<!-- … -->` blocks from the doc with `sed '/<!--/,/-->/d'` (no new runtime dep — stays on the skill's existing grep/sed/find toolset; block comments in these docs span whole lines), then count `^##` headings; zero → `[W008] Empty domain doc: <file> — fill from packages/cli/templates/<doc>-template.md (BDD intake references degrade until filled)`. Absent file → no output. The install scaffold's example headings sit inside its comment, so a verbatim scaffold counts as zero.
3. **Surface drift (E008):** build the defined-slug set by slugifying each uncommented `^##` heading in `surfaces.md` with a **portable** pipeline — `tr '[:upper:]' '[:lower:]'` then `sed 's/[^a-z0-9]\{1,\}/-/g; s/^-//; s/-$//'` (NOT `sed \L`, which BSD/macOS sed does not support — proven by a `laude-ode` misfire during planning). Collect referenced slugs from `@surface.<slug>` on **tag lines only** (`^[[:space:]]*@…`) across `features/**`. Each referenced slug absent from the defined set → `[E008] Surface drift: @surface.<slug> referenced in features/ but no matching entry in surfaces.md`. **Suppressed when `surfaces.md` is empty/absent** (W008 already says "fill it").
4. **Persona drift (E009) — spec lines only:** decided with the user — the feature lineage-tag source is dropped (ticket-ID pollution). Build the defined-code set from `personas.md` headings: explicit `## Name (CODE)` first, else derived fallback (multi-word → initials, single → first two chars, uppercased). Collect referenced codes from ticket `spec.md` `**Persona:** … (CODE)` lines **after stripping HTML comments** (`sed '/<!--/,/-->/d'`, so the template's commented `Platform Operator (PO)` example does not fire — verified: comment-stripping drops the 29 PO hits and leaves one real `DEV` drift). Each referenced code absent from the defined set → `[E009] Persona drift: code <CODE> referenced in a spec but no matching entry in personas.md`. **Suppressed when `personas.md` is empty/absent.**

**Proof plan (per scenario → highest practical scope):**

| Scenario group | Primary proof | Why enough |
| -------------- | ------------- | ---------- |
| R1 (E008: drift, multi-word clean, defined-unreferenced, prose-only) | **integration** — extract the block, `spawnSync bash` against mkdtemp fixtures, assert stdout has/omits the E008 line | Exercises the real bash end-to-end (wiring); portable slugify + tag-line anchoring proven |
| R2 (E009: live-spec drift, clean, commented-example) | **integration** — fixtures with `.project/tickets/X/spec.md` (live + commented variants) | The comment-strip anchoring must run, not be asserted as prose |
| R3 (W008: verbatim surfaces/glossary scaffold, populated, absent, empty-suppresses-drift) | **integration** — fixtures use the real template bytes for the scaffold cases | comment-aware `##` count + doc→template map + absent-skip + suppression exercised |
| R4 (in-sync → silent; edited-definition → same result) | **integration** — in-sync fixture asserts zero E/W; edited-definition fixture asserts byte-identical output to the in-sync run | Proves the detector never touches content meaning |
| R4 doc-text; all rules parity | **unit (content assertion)** — `it.each(AUDIT_SURFACES)` asserts the advisory-only sentence + codes E008/E009/W008 present in the new subsection AND the Report Format legend across all 3 byte-identical `SKILL.md` mirrors | Locks parity + the human-owned-content instruction + the legend |

**Wiring:** entry point is the bash block; integration proofs run it via `bash -c "<extracted block>"` using a **marker-based** extractor (find the block containing the `# domain-docs-check` sentinel), robust to added blocks. The fixtures do NOT stub `bun`; the `[ -d "$NS_ROOT" ]` fallback makes the block resolve the fixture's `.project/` without the real resolver present.

**Build order (harness first, then load-bearing):**

1. **Emptiness (R3)** — thinnest vertical slice: stands up the block skeleton, NS-root resolution + `[ -d ]` fallback, comment-aware counting, doc→template map, and the marker-based fixture harness.
2. **Persona drift (R2)** — the comment-strip anchoring; built early so a wrong extraction fails on its guard scenarios while cheap.
3. **Surface drift (E008/R1)** — portable slugify + tag-line anchoring + empty-suppression; also feeds R4's in-sync fixture.
4. **R4 integration + content assertions + Report Format legend + 3-mirror parity sync.**

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Where detection lives | Deterministic `bash` block in the audit SKILL.md | New `safeword check --docs-coverage`; extend `health.ts` | figure-it-out Option A: matches Section 3 W006; no cross-harness CLI code; ships identically to 3 mirrors |
| E009 reference source | Comment-stripped spec `**Persona:**` lines ONLY | Specs + feature lineage tags | Empirically proven: lineage field-2 carries ticket-IDs/foreign codes indistinguishable from persona codes → E009 storm. Spec lines resolve cleanly + catch the real DEV drift (user-confirmed) |
| Emptiness detection | Comment-aware `##` count (strip `<!-- -->` first) | Raw `^##` count; scaffold byte-match | Raw count counts the scaffold's commented example headings → never zero; byte-match is brittle to any edit. Comment-aware matches parsePersonas/parseGlossary semantics |
| Namespace-root fallback trigger | `[ -d "$NS_ROOT" ]` false | Empty-stdout or non-zero-exit | The reused harness stubs `bun` as an echo → resolver "succeeds" with garbage stdout; only a directory-existence guard is robust |
| Slugify casing | `tr '[:upper:]' '[:lower:]'` | `sed 's/.*/\L&/'` | BSD/macOS sed lacks `\L` — misfired `laude-ode` in planning; must run on darwin + Linux CI |
| Empty/absent doc precedence | Suppress that doc's drift codes; emit only W008 | Emit W008 + one drift per reference | An empty personas.md would bury W008 under an E009 per referenced code — noise, not signal |
| Test block extraction | Marker-comment-based extractor | Ordinal (Nth ```bash block) | Ordinal breaks when a block is added earlier; existing harness hard-codes block 2 |

## Arch alignment

Honors the audit skill's stated **class-2 / report-only / read-only** principle (`SKILL.md:13`, `PRINCIPLES.md §1`) and the Section 5 precedent of reconciling prose against a machine-readable source of truth without auto-overwriting prose (`SKILL.md:404-418`). `skip: no new architectural decision — extends an existing documented pattern`.

## Known deviations

- Per-file config overrides (`paths.personas` / `paths.surfaces` / `paths.glossary`) are NOT honored — the block reads default namespace-root locations. Acceptable: `safeword check` (`health.ts`) already validates the configured-path variants; this check is a complementary reporter. Documented as a coverage limitation in the subsection.
- Persona-code derivation fallback does not reproduce `safeword check`'s collision-suffix numbering (`PO2`) — acceptable because post-check headings carry explicit codes the explicit-extraction path reads directly.
- Persona drift reads spec lines only (no feature-tag source) — a persona named only in a scenario's prose (not a spec) is not checked; features carry no reliable structured persona reference.

## Doc impact

`docs.sources` not configured. The authoritative code legend is the skill's own **Report Format** (`SKILL.md:439-456`) — add E008/E009/W008 there in all 3 mirrors alongside the new subsection. During implement, also grep `packages/website/**` for any audit-code enumeration; add there if one exists, else `skip: no canonical audit-code list outside the skill`.

## Assessment triggers

Revisit if: persona references gain a reliable structured form in `.feature` files (reopen the feature-source); a per-file `paths.*` override becomes common enough that default-location reading misfires; surface heading conventions add qualifiers that break slugify; or the block outgrows readable bash — then promote to a tested helper reusing `resolvePersonaCodes`/`parseGlossary` (the figure-it-out Option B/C boundary).
