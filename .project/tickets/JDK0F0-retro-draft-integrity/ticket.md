---
id: JDK0F0
slug: retro-draft-integrity
type: task
phase: done
status: done
created: 2026-07-07T05:31:41.043Z
last_modified: 2026-07-07T05:31:41.043Z
external_issue: https://github.com/ArcadeAI/safeword/issues/773
scope:
  - buildDraft seals the final body (signature marker included) with bodyDigest = shortHash(body)
  - SpooledDraft carries an optional bodyDigest; the spool writes and round-trips it (legacy digest-less lines stay valid)
  - verifyDraftBody in retro-draft-spool.ts recomputes the digest (inline sha256-12hex — module is self-contained) and returns false only on mismatch
  - fileSpooledDrafts refuses to post a mismatched draft — it stays spooled, counted in an additive rejected field
  - retro/SKILL.md never-re-word rule + self-report-filing.md verbatim rule trim to enforcement pointers; filer agent def notes the seal
out_of_scope:
  - verifying posted issue bodies against acks after the fact (gate-side tripwire — a later rung if needed)
  - digesting the deterministic self-report spool (different schema, different threat surface)
  - REST-path in-memory verification (triage consumes buildDraft output directly in-process; no tamper window)
done_when:
  - a spooled draft whose body was modified after sealing is not posted by the filing seam and remains spooled
  - legacy digest-less drafts still post and drain (back-compat)
  - buildDraft output passes verifyDraftBody (cross-module algorithm agreement pinned by test)
  - repo lint/tests green; parity synced; prose trimmed to pointers
---

# Spooled retro drafts carry a body digest; emit and filing refuse modified bodies

**Goal:** A sanitized draft's body is hashed at spool time and every code-owned consumer (self-report --format issue, the REST filer path) refuses or flags a draft whose body no longer matches, graduating retro/SKILL.md's never-re-word rule

**Why:** #773 rung 3: the egress sanitizer is the security boundary keeping customer data off a public tracker, but nothing detects a draft body modified after sanitization — the signatureMarker hashes finding identity, not content

## Work Log

- 2026-07-07T05:31:41.043Z Started: Created ticket JDK0F0
- Scouted: spool consumers are retro.ts (spool+count), retro-nudge, retro-filing-gate (read-only), and fileSpooledDrafts (the executable filing seam) — the tamper window is the on-disk spool between sessions, so the seal verifies there; REST path consumes buildDraft output in-process (no window, out of scope)
- TDD: 11 RED (seal = shortHash(final body); cross-module verifier agreement; spool round-trips the seal as the only fifth field; verifyDraftBody match/mismatch/legacy matrix; filing seam refuses tampered draft — no post, no ack, stays spooled, additive rejected count; legacy digest-less drafts keep filing) → GREEN via draft.ts bodyDigest + retro-draft-spool.ts verifyDraftBody/rejected; 210/210 retro+parity+contract tests, tsc clean, parity synced (7 mirrors), prose pointed at the enforcing seam (retro/SKILL.md, self-report-filing.md, filer agent md+toml)
- 2026-07-07T06:21:22.420Z Phase: intake → done
- 3-stage pass (post-rebase onto v0.67.0): verify all lanes green + audit clean (jscpd +3 attributable to incoming release commit); quality-review APPROVE, 0 critical — applied 4 of 5 suggestions (wiring-chain assertion in the real-pipeline test, prose over-claim softened to "code-owned seams", 2 stale four-field comments, non-string bodyDigest shape pin); 5th (fail-closed graduation once all writers seal) already recorded in out_of_scope as the later rung; refactor: sealedRetroDraft centralized in tests/helpers.ts (one-entry ledger; knip + depcruise clean after)
