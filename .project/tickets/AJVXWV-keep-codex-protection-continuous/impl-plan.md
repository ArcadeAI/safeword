# Impl Plan: Keep Codex protection continuous while teams migrate

**Status:** planned

## Approach

The riskiest assumption is that a trusted plugin dispatcher can identify itself
without inspecting Codex's private trust state, record profile proof, and still
defer event authority to a legacy project handler. The cheapest proof is the
pair “Trusted plugin SessionStart records current proof” and “Legacy handler
remains authoritative for a covered event,” exercised through the real CLI
hook entry point with temporary profile and project boundaries.

Build order:

1. **Schema inventory slice.** Add `SAFEWORD_SCHEMA.codexMigration` ownership,
   preservation metadata, exact handler/runtime viability rules, and
   reconciliation tests. This lands before every consumer so schema remains the
   source of truth.
2. **Proof and identity slice.** Add the plugin-hook marker contract, schema-1
   proof writer/validator, restart-pending marker, manifest hashing, and
   SessionStart wiring. Primary
   proof: CLI/hook integration. Supporting proof: table-driven unit corruption
   cases and release manifest contract.
3. **Observation and status slice.** Add the typed migration state, legacy
   event/asset inventory, precedence, human renderer, JSON renderer, and exit
   matrix, including disabled, restart-required, finalized teammate, and error
   states. Primary proof: CLI integration with real filesystem collaborators
   and fake Codex subprocess. Supporting proof: pure transition/schema tables.
4. **Compatibility slice.** Suppress only the plugin event already covered by
   a viable schema-owned legacy handler. Primary proof: real dual-dispatch
   integration, including a configured handler with a missing runtime.
5. **Finalization and recovery slice.** Add plan/confirmation, fingerprinted backup manifest,
   selective cleanup, marker/bootstrap, rollback, idempotence, deprecated alias,
   successful `--finalize --yes`, conflict-safe recovery, and recovery command.
   Primary proof: CLI integration through real temporary repositories.
   Supporting proof: transaction-boundary failure tables and intervening-edit
   conflict tests.
6. **Acceptance and docs slice.** Bind all Gherkin steps, update README,
   configured website docs, and the existing “Profile-Scoped Generated Codex
   Plugin and Staged Hook Migration” architecture decision. Run release,
   Cucumber, full suite, typecheck/lint, verify, audit, and the independent
   quality review.

Every new CLI entry point (`status`, resumable `migrate`, `recover`) gets at
least one wiring test built from real command parsing, migration domain, and
temporary filesystem; only Codex subprocess, profile home, prompt input, clock,
and forced filesystem failure are boundaries.

Affected surface proof:

- **OpenAI Codex:** packaged hook integration and versioned release contract.
- **Safeword CLI:** command-level integration plus Cucumber acceptance lane.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Trust evidence | Content-bound SessionStart operational proof written only by commands carrying `--plugin-hook` | Plugin enabled state; private trust-store inspection; cryptographic attestation | Enablement is not execution; private trust state is unsupported; local profile owners can always forge local state, so the contract is explicitly operational rather than tamper-resistant. |
| Proof identity | SHA-256 of exact packaged hook manifest bytes plus package version | Parsed/canonicalized JSON; timestamp-only proof | Exact bytes bind proof to what Codex reviewed and avoid a second canonicalization contract. |
| Compatibility | Event-level legacy authority | Whole-plugin no-op; always run plugin | Whole-plugin suppression leaves partial installs uncovered; always-run duplicates gates. |
| Generic upgrade | Preserve schema-owned historical Codex assets until finalization | Conditional deletion after local proof; existing unconditional deprecation; separate inventory module | Profile proof is private to one teammate, and a separate list would violate schema ownership. |
| Recovery | Fingerprinted, containment-checked project backup with conflict-safe rollback and explicit recover command | Git-only recovery; blind restore; best-effort deletes | Git cannot restore untracked/custom assets; blind restore overwrites intervening edits; best-effort cleanup violates continuous protection. |
| Status | One typed result rendered as human or schema-1 JSON | Separate prose and JSON implementations | Shared state derivation prevents semantic drift and is the local precursor to #1574's project-wide renderer boundary. |

Evidence:

- Current repository decision “Profile-Scoped Generated Codex Plugin and
  Staged Hook Migration” establishes that enabled does not imply trusted.
- Current `migrate-codex-plugin.ts` already validates TOML, uses exact ownership
  matching, durable temporary files, and atomic rename; the plan extends those
  proven patterns.
- OpenAI's current plugin guidance distinguishes plugin installation from the
  permissions and confirmations governing included capabilities:
  <https://help.openai.com/en/articles/20001256-plugins-in-codex/>.
- Rolling migration and explicit recovery follow the Expand → Prove → Contract
  evidence recorded in issue #1572.

## Arch alignment

- **Schema as Single Source of Truth:** historical Codex identities and
  migration ownership metadata live on `SAFEWORD_SCHEMA.codexMigration`; hooks,
  reconciliation, status, and finalization derive from that schema section.
- **Reconciliation Over Copy:** cleanup is planned, selective, idempotent, and
  recoverable.
- **Profile-Scoped Generated Codex Plugin and Staged Hook Migration:** retain
  old protection until replacement execution is proven.
- **Explicit Project Enrollment for Profile-Scoped Codex Hooks:** profile proof
  may be written before enrollment, but project state and gates remain guarded
  by `.safeword/SAFEWORD.md`.
- **Commands never own domain truth:** command adapters render values returned
  by the Codex migration module.

## Known deviations

The current Codex migration logic lives almost entirely in one command module.
This plan moves reusable state and proof logic into the existing
`src/codex-plugin/` module while keeping historical identity metadata on
`SAFEWORD_SCHEMA`. The health defect is that hook dispatch, schema
preservation, status, and cleanup otherwise need duplicate ownership rules. No
new top-level architectural module is introduced.

The plan exceeds Safeword's scenario split suggestion but remains one feature:
all clusters share one state precedence and transaction boundary, and splitting
would make the continuous-protection invariant depend on partially shipped
children.

## Doc impact

- `README.md`: replace the two-step cleanup shorthand with resumable status,
  proof, finalization, and recovery.
- `packages/website/src/content/docs/getting-started/quick-start.mdx`: explain
  the safe existing-repository migration.
- `packages/website/src/content/docs/reference/cli.mdx`: document `codex
  status`, `migrate --finalize --yes`, JSON/exit semantics, and `recover`.
- `ARCHITECTURE.md`: evolve the existing staged Codex migration decision with
  proof, event authority, and transactional recovery.

## Assessment triggers

- Codex publishes a supported hook-trust/status API.
- Codex provides project-scoped plugin activation.
- Plugin hook payloads gain a stable installed-plugin identity, removing the
  need for the internal marker.
- The plugin manifest format stops being stable byte-addressable JSON.
- A second migration consumer needs the state/result model; at that point move
  it into #1574's project-wide CLI engine rather than copying it.
