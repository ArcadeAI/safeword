# Impl Plan: Gate Bash-channel writes to the R/G/R ledger (#644 G3)

**Status:** planned

## Approach

**Riskiest assumption:** a conservative, token-level classifier over shell words can
separate *write-target* references to a ledger file from read/mention references without
over-denying — proven cheapest by the predicate unit-test pair "output redirection into the
ledger is denied" vs "redirecting ledger contents to another file is allowed" (the
source-vs-target boundary). If that pair can't both pass, the design is wrong at slice 1.

**Components:**

- `templates/hooks/lib/bash-ledger-writes.ts` (new) — pure predicate:
  `detectLedgerWrite(command) → { shape, path } | undefined`. Reuses segment/word parsing
  extracted from `cursor/gate-adapter.ts` into `templates/hooks/lib/shell-segments.ts`
  (dependency direction: cursor adapter imports from lib, never the reverse). Ledger path
  test: basename `test-definitions.md` AND `isNamespacePath(token, 'tickets/')` — the same
  string-level check the Edit-path gate uses, keeping cross-channel verdicts consistent
  (reconciled from the planned `(command, projectDirectory)` + `resolveNamespaceRoot`
  signature: the fs-free string check is strictly simpler and matches the Edit gate's
  existing scoping, including its known paths.projectRoot limitation). Module docs carry
  the detection-limits block (variables, eval, substitution, script files; done-gate
  backstop).
- `templates/hooks/pre-tool-quality.ts` Bash branch — deny on detection, message naming the
  Edit channel. Codex inherits via `codex/pre-tool-quality.ts` translation (no change).
- `cursor/gate-adapter.ts` — `requiresFailClosedShellGate` widens: git-commit segment OR
  ledger-write detection.

**Proof plan (highest practical scope per scenario):**

| Scenario (ledger) | Primary proof | Why enough |
| --- | --- | --- |
| Bulk-tick sed denied (anchor) | integration — spawn the Claude hook with the literal #644 Bash payload | proves the real entry point end-to-end; the exact regression from the audit |
| Read-only / no-reference / mention-only / read-source-redirect allowed | unit on the predicate | pure logic; hook wiring already proven by the anchor |
| Write-shape outline (9 shapes) | unit on the predicate | combinatorial pure logic — unit is the highest practical scope |
| Compound-command segment | unit on the predicate | same |
| Outside-namespace allowed | unit on the predicate | path-scope logic is pure given projectDirectory |
| Obfuscated write allowed by design | unit on the predicate | pins the conservative verdict |
| Module documents limits | doc-content test reading the module source | repo precedent (documentation tests); the claim is about the text |
| Claude gate denies via Bash branch | integration — spawn hook | wiring seam |
| Codex adapter deny + allow pass-through | integration — spawn codex adapter | wiring seam (translation layer) |
| Cursor pre-filter requires / does not require gate | unit on `requiresFailClosedShellGate` | pure predicate; the spawned gate itself is proven by the Claude integration |
| Denial names Edit channel + reason | integration — assert message content from hook output | the message is the product surface |

**Build order** (each slice builds on green):

1. **Anchor slice (load-bearing):** RED integration test — Claude hook allows the #644 sed
   today; GREEN — extract `shell-segments.ts`, add minimal `bash-ledger-writes.ts`, wire the
   deny. Fails cheap if the classifier design is wrong.
2. **Precision slices:** predicate unit scenarios (allow-side first: read-only, no-reference,
   mention-only, read-source redirect — the over-denial guards), then write-shape outline,
   compound, namespace scope, obfuscated-allow.
3. **Message slice:** denial content (TB1.AC1).
4. **Harness seams:** Codex deny + allow integrations; Cursor pre-filter unit pair.
5. **Docs slice:** module-limits doc test.
6. Parity sync (`bun scripts/parity-check.ts --fix` semantics: templates are source of
   truth; dogfood mirrors copied) — continuous, verified per commit by the pre-commit hook.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Enforcement strategy | Deny Bash-channel ledger writes (channel-forcing) | Simulate shell + validate post-state; PostToolUse detect/repair | Simulation statically impossible (HotOS'25); PostToolUse can't deny — damage committable (how G3 shipped) |
| Shell parsing | Extract `splitShellSegments`/`parseShellWords` from cursor/gate-adapter into lib | Duplicate parsing in the new module; lib importing from cursor/ | Duplication drifts; cursor/→lib is the established dependency direction |
| Ledger-path scope | basename + `isNamespacePath(token, 'tickets/')` string check (fs-free) | Any file named test-definitions.md; `resolveNamespaceRoot` fs resolution | Fixture/tmp files outside the namespace must stay writable (SM2.AC2); the string check mirrors the Edit gate's scoping so channels can't drift |
| Inline interpreters | Deny when inline-code flag + ledger path in segment (over-approximate) | Parse interpreter code for write APIs | That's simulation again; documented in module limits |
| Cursor coverage | Widen `requiresFailClosedShellGate` with the shared predicate | Cursor-side reimplementation | One predicate, three consumers (SM1.AC3); reimplementation drifts |

## Arch alignment

- **Continuous Quality Gates (LOC + Phase + TDD)** — joins the pre-tool-quality gate family
  as a hard PreToolUse block, same deny shape.
- **Hard Block for Done Phase (Exit Code 2)** — this gate is the write-time complement; the
  done-gate's distinct-SHA ledger validation stays the backstop for what detection misses.
- **Adapter-as-source-of-truth pattern** (codex/pre-tool-quality.ts, cursor/gate-adapter.ts
  module comments): gate logic lives once in the Claude hook; adapters translate. This
  feature adds logic only there plus the Cursor pre-filter predicate.

## Known deviations

skip: no deviations planned

## Assessment triggers

- A fourth harness adapter appears → its shell path must consult the same predicate.
- The predicate's false-positive reports (blocked legitimate commands) accumulate →
  revisit write-shape list rather than loosening namespace scope.
- Claude Code hook API exposes structured command ASTs → replace token parsing.
- G1/G4 branch lands artifact-cascade changes touching the Bash branch → reconcile at merge.
