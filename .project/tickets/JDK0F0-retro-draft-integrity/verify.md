# Verify: retro-draft-integrity (JDK0F0)

Ran 2026-07-07 on branch claude/retro-draft-integrity, Node 24 container.

## Verify Checklist

**Test Suite:** ✓ 4898/4898 tests pass (338 files, 7 conditional skips; includes the 11 new seal/refusal scenarios and the updated no-leak disk-key pin)
**Gherkin:** ✅ Acceptance lane passes (295/298 scenarios, 3 environment-conditional skips)
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (`tsc --noEmit` clean via typecheck lane; eslint clean on changed files; lint-staged ran at commit)
**Scenarios:** ⏭️ Skipped — task ticket (inline tests: seal = shortHash of final body; cross-module verifier agreement; spool round-trips the seal; verifyDraftBody match/mismatch/legacy matrix; filing seam refuses a tampered draft — no post, no ack, stays spooled, additive rejected count; legacy digest-less drafts keep filing)
**PR Scope:** ✅ Diff matches ticket scope (draft.ts seal + retro-draft-spool.ts verify/refuse + tests + prose pointers at retro/SKILL.md, self-report-filing.md, filer agent md/toml + parity mirrors + ticket artifacts; nothing else)
**Dep Drift:** ✅ Clean (no new dependencies)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation (optional-field schema evolution with fail-open back-compat mirrors the FiledAck addition in GH644A; the inline sha256-12hex in the self-contained spool module is pinned to src/retro/hash.ts by a cross-module test)
**Experience:** ⚠️ 1 designed friction point — walked the filer agent through a tampered-draft session: the draft is refused, never posted, and stays spooled, so the stop-gate nudge keeps surfacing it until a human inspects/deletes it. Worst step = a tampered draft never self-heals (deliberate: visible-stuck beats silent-discard for a security seal). Legacy digest-less spools: zero new steps. Enforcement covers code-owned seams only; an LLM filer bypassing the seam via direct MCP is out of scope (gate-side ack tripwire = a later rung, recorded on the ticket).
**Evidence limits:** ✅ None (all lanes ran clean locally)

Audit passed — sync-config ✓, depcruise ✓ (583 modules, 0 violations), knip ✓ clean (no findings, no W005 hints), jscpd 424 clones (8.77%) [repo minus .safeword/.project] — -1 vs the previous 425 at the same scope, no new duplication from this diff; learnings Covers: ✓; outdated deps all dev-only patch/minor plus the three already-tracked majors (unicorn 71 pin, typescript 6 → ticket 091, cucumber-messages 34).

Post-rebase revalidation (onto v0.67.0 main): all verify lanes re-ran green (4898/4898, Gherkin 295/298, build/typecheck/deps exit 0); audit re-passed — jscpd 427 (8.83%) at the same scope, +3 attributable to the incoming release commit (this diff unchanged between measurements).
