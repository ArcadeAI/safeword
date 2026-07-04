# Impl Plan: Converge spec grammar on a single Rule tier

**Status:** planned

## Approach

**Riskiest assumption:** that we can delete the mixed-criteria *guard* and collapse
the reported *vocabulary* to one tier **while keeping** the internal AC/R id split
(needed so the retained AC-wins precedence and legacy coverage tracing still work).
If that split can't survive the guard's removal, the whole soft-deprecate design is
wrong. **Cheapest proof (slice 1):** the SM1.R2 scenario "A mixed JTBD's criteria are
still traced for coverage" — both the AC and the Rule report uncovered — proves the
parser still separates the two kinds internally even though nothing flags the mix.
That fails on slice 1 if the design is wrong, before any codemod or template churn.

**Proof plan + build order** (outside-in; load-bearing slice first, then dependency
order):

1. **Coverage vocabulary collapse + guard deletion (SM1.R2)** — *load-bearing.*
   Delete `findMixedCriteriaJtbds` + its `health.ts` `ruleTierDiagnostics` issue;
   reword `formatCoverageReport` uncovered/stale/orphan to one Rule vocabulary (drop
   the `isRuleId` AC-vs-rule message branch — everything reads "Rule"). Keep
   `parseCriteriaIdsByJtbd`'s internal `{acIds, ruleIds}` split intact.
   **Primary proof:** `unit` — `scenario-coverage.test.ts` (mixed still traced;
   uncovered worded in Rule terms for both a `.R` and a `.AC` id) + `check.test.ts`
   (no mixed issue emitted). Highest practical scope: these are pure functions +
   the check advisory formatter; unit is sufficient.

2. **Intake-gate rewording (SM1.R3)** — `templates/hooks/lib/jtbd.ts` **and its
   byte-identical `.safeword/hooks/lib/jtbd.ts` mirror**: `evaluateAcGate` denial
   names only `#### <id>.R<n>` (drop the AC co-equal phrasing); empty-skip + valid-skip
   paths unchanged. **Primary proof:** `unit` — `ac-gate.test.ts` (denial names Rule,
   NOT Acceptance Criteria; skip-with-reason passes; empty-skip denies). Parity test
   `parser-parity`/mirror keeps the two copies identical.

3. **Legacy AC back-compat (NTB1.R1)** — mostly *proving retained behavior*: AC parse,
   AC-only gate pass, AC-wins precedence (`@feat.R1.AC1`→AC), persona-code-`R`
   (`@feat.R1.R2`→rule), stale undeclared-AC. Minimal/no new code — existing precedence
   tests must stay green. **Primary proof:** `unit` — `scenario-coverage.test.ts` +
   `gherkin-feature.test.ts` (existing precedence cases retained, not deleted).

4. **Deprecation nudge (NTB1.R2)** — new `scenario-coverage.ts` detector (any `.AC`
   heading in spec or `.ac` ref in feature → legacy-AC signal) wired into `health.ts`
   `coverageDiagnosticsForTicket` as a zero-exit **advisory**, reusing the existing
   in-progress + spec-bearing scope (so completed/ tickets never nag). Message names
   `safeword migrate-ac`. **Primary proof:** `unit` (detector) + `check.test.ts`
   (advisory on in-progress AC ticket; silent on Rule-only; silent on completed;
   advisory bucket not issues bucket).

5. **Codemod `safeword migrate-ac` (TB1.R1, TB1.R2)** — new pure util
   `utils/migrate-ac.ts` (per-file: parse AC ids + declared R ids per JTBD → detect
   collision → if clean, rewrite `.AC<n>`→`.R<n>` in headings, `@…AC<n>` tags, and
   `### Scenario: …AC<n>` refs same-number; if collision, return the file untouched +
   a report) + `commands/migrate-ac.ts` + `cli.ts` wiring (`--dry-run`). Load-bearing
   sub-slice: collision detection first. **Primary proof:** `unit` — transform over
   string fixtures (each artifact target; idempotent; leave-non-AC; per-file collision
   refusal; multi-AC; clean-file-still-migrates). **Supporting `integration` (wiring):**
   one `migrate-ac.test.ts` driving `cli.ts → command → real fs` on a temp dir, mocking
   only the fs boundary — proves config→command wiring, not just the pure core.

6. **Authoring-surface vocabulary (SM1.R1)** — spec-template ×2, bdd DISCOVERY/SCENARIOS
   ×3, review-spec, guides: scaffold only Rule; remove the "one criteria kind, never
   both" doctrine + AC-co-equal option. **Primary proof:** `unit` content-assertion
   (shipped template/skill strings contain Rule scaffolding + do NOT contain the doctrine
   / AC-option), mirroring how #713 pinned template↔hook parity. Template↔`.claude`/
   `.agents`/`packages/cli/templates` parity kept via the existing contract check.

7. **Repo live-surface migration** — run the built `migrate-ac` over the running lanes
   (`features/`, `packages/cli/features/`) and active in-progress ticket dirs; leave
   `completed/` specs. **Proof:** full suite + `test:bdd` Gherkin lane green, no new
   stale/orphan coverage advisories. Sequenced last so it runs the *proven* codemod.

## Decisions

| Decision                          | Choice                                                              | Alternatives considered                                  | Rejected because                                                                                      |
| --------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| AC retirement mechanism           | Soft-deprecate: keep parsing + precedence, warn, codemod           | Hard-cut AC parsing (issue's original framing)           | Would silently block existing AC projects' intake on upgrade — the exact NTB trust failure (#716 comment) |
| What actually gets deleted        | The mixed-criteria *guard* + dual *vocabulary*, NOT AC ref parsing | Delete AC ref-parse + AC-wins precedence (issue body)    | Precedence is still needed for legacy `@feat.R1.AC1` refs and persona-code-`R` safety under soft-deprecate |
| Codemod atomicity unit            | Per-file: a collision refuses the whole file, other files proceed  | Per-JTBD selective rewrite; whole-run abort on any clash | Per-JTBD leaves confusing intra-file half-states; whole-run abort blocks a 50-file migration on one clash |
| Codemod command surface           | Top-level `safeword migrate-ac` with `--dry-run`                   | `safeword codemod ac-to-rule`; migrate subcommand        | User signoff chose the short discoverable form                                                        |
| Deprecation-nudge scope           | Reuse in-progress + spec-bearing check path                        | New global repo scan for `.AC`                           | A global scan would nag completed/ historical records; coverage scope already excludes done tickets   |

## Arch alignment

skip: no ADRs in this project yet (no `paths.architecture` record set; `check` treats
this section as satisfied). This ticket introduces no new cross-feature pattern — it
converges an existing two-tier grammar the predecessor V0NHT6 already established.

## Known deviations

skip: no deviations planned — conforms to the existing coverage/gate/parser structure
and the template↔mirror parity discipline #713 set.

## Assessment triggers

- Hard-removal of `.AC` parsing (a later major) — revisit the precedence retention and
  delete the legacy alias + deprecation nudge together.
- A downstream repo reports a codemod collision in the wild — revisit per-file atomicity
  vs. an interactive resolve.
- A second codemod is added — revisit whether `migrate-ac` should move under a `codemod`
  subcommand namespace.
