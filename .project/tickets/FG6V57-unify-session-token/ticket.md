---
id: FG6V57
slug: unify-session-token
type: task
phase: implement
status: in_progress
created: 2026-07-08T05:11:53.040Z
last_modified: 2026-07-08T05:11:53.040Z
---

# Unify session-id sanitizers behind a parity contract

**Goal:** One sanitization rule (charset + substitute + length cap) pinned byte-identical across triage.ts, retro-draft-spool.ts, and self-report.ts via the parity contracts schema

**Why:** Three copies have already drifted (charset, strip-vs-substitute, cap); emitted tokens are idempotency keys and spool filenames, so drift is a correctness risk but a shared import would dissolve the spool's deliberate self-containment

## Decision (figure-it-out, 2026-07-08)

The three sites: `src/retro/triage.ts:104` (public ledger JSON — `/[^\w.-]/g → '_'`, no cap),
`templates/hooks/lib/retro-draft-spool.ts:48` (spool filename — same rule, no cap),
`templates/hooks/lib/self-report.ts:139` (`sanitizeToken` — adds `@`, strips instead of
substitutes, caps at 80; also used for non-session fields, which stays as-is).

**Chosen:** align the session-id rule (one charset, substitute-not-strip, add the missing
length cap to triage + spool) and pin the shared snippet in all three files via the parity
**contracts** schema (`schema.ts` `contracts:` — pre-commit hard block, the #801 precedent).

**Rejected:** a shared helper module — the spool is deliberately self-contained (node:* only)
and a cross-boundary import dissolves that; doc-only — the contract costs one schema entry
and actually enforces.

**Compatibility note:** all rules are identity for UUID-shaped session ids, so emitted
tokens (ledger idempotency keys, spool filenames) only change for pathological ids —
still a behavior change, hence a task, not a refactor. Adding the cap bounds the
previously unbounded public-comment token (triage) and filename (spool).

**Premortem:** an equivalent-but-reformatted regex trips the byte-exact contract and
confuses the editor — keep the pinned snippet minimal and comment the contract with intent.

## Work Log

- 2026-07-09T23:00:00.000Z Implemented per the recorded decision, TDD (3 RED → GREEN): one rule `.replaceAll(/[^\w.-]/g, '_').slice(0, 80) || 'unknown'` in triage.ts (ledger token — gains the missing cap), retro-draft-spool.ts (filename — gains the cap), self-report.ts (sessionId sites switch from sanitizeToken's strip+@ to substitute; sanitizeToken retained for version/source). Mirrors synced to .safeword. Three parity contracts added in schema.ts (SESSION_TOKEN_RULE) — negative-tested: a mutated copy hard-fails `parity-check --mode=contracts-only` with `[CONTRACT] Missing in …triage.ts`. Evidence: 99/99 across triage/spool/self-report/schema suites; parity 215 pairs + 8 contracts in sync; eslint/tsc clean. UUID-shaped ids are unchanged under the rule (no token migration).
- 2026-07-08T05:11:53.040Z Started: Created ticket FG6V57
- 2026-07-08T05:13:00.000Z Decision recorded (parity contract over shared helper); parked to backlog
- 2026-07-09T22:40:30.986Z Phase: intake → implement
