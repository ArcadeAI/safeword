# Impl Plan: `safeword retro` — transcript-mining session retrospective

**Status:** planned

## Approach

**Riskiest assumption:** the automated egress guard actually prevents
transcript-derived customer data from reaching a filed issue — the entire safety
case for autonomous filing. The cheapest proof is the load-bearing slice:
`NTB1.AC2.end_to_end_filed_payload_carries_no_customer_data` — run the real
command with the GitHub transport mocked and assert the payload handed to the
transport contains neither a planted secret token nor a customer path. If the
guard is wrong, slice 3 fails while the design is still cheap to change.

Per-behavior ownership and proof (highest practical scope from `testing/SKILL.md`):

| Behavior (AC) | Owning component | Primary proof | Why enough |
| --- | --- | --- | --- |
| Transcript read + finding schema (TB1.AC2, NTB1.AC1) | `retro/transcript.ts` reader + `retro/finding.ts` schema/normalizer | unit | pure parse/normalize; assert extracted fields + stray-field drop directly |
| `retro:` signature (SM1.AC1) | `retro/signature.ts` | unit | pure function; assert prefix + non-collision with spool `signatureOf` |
| Egress guard: resolve + sanitize + fail-closed (NTB1.AC2) | `retro/egress.ts` (reuses `safewordInternalTail`; scrub via library — see Decisions) | unit + **integration** | pure sanitizer unit-tested on each pattern; the leak guarantee proven end-to-end through the command (transport mocked) — unit alone can't prove what reaches the wire |
| Dedup + occurrence ledger (SM1.AC2, SM1.AC3) | `retro/dedup.ts` + `retro/ledger.ts` | unit + integration | dedup decision pure; ledger idempotency (session-id key) + novel-vs-count proven against a mocked transport |
| Command wiring + autonomous file (TB1.AC1) | `src/commands/retro.ts` | integration (wiring) | real config→module wiring; only the GitHub transport boundary mocked |

**Build order** (dependency-free first, load-bearing slice as early as its deps allow):
1. `transcript.ts` + `finding.ts` (schema/normalize) — no deps.
2. `signature.ts` — no deps.
3. **`egress.ts` (load-bearing leak slice)** — depends on finding shape; build as soon as 1 lands so a wrong guard fails early.
4. `dedup.ts` + `ledger.ts` — depend on signature.
5. `commands/retro.ts` wiring + autonomous file — composes 1–4; carries the end-to-end leak + autonomy integration scenarios.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Extraction/egress split | Command (code) owns read→assemble→sanitize→file; agent owns only extraction + redaction judgment | Agent files directly via MCP/`gh` | Agent-owned egress lets free text reach the wire — the leak hole |
| Issue body source | Code-assembled from a constrained schema | Agent writes the body prose | No allowlist over free prose; schema removes any sanctioned home for customer data |
| Path sanitizing | Reuse `safewordInternalTail` allowlist (keep safeword paths, drop the rest) | New path regex | Already battle-tested in the spool sanitizer; don't fork it |
| Secret/token scrub (free text) | **Focused vendored secret-pattern set behind a `scrubSecrets` seam** (gitleaks-derived high-signal patterns: AWS/GCP/Slack/Stripe/GitHub/JWT/PEM/high-entropy). secretlint = documented drop-in upgrade behind the same seam | secretlint now (heavy dep tree + CLI startup-perf concern, ticket 34FRZR); redact-pii (abandoned ~4yr); @redactpii/node (phones home); Presidio (Python-only) | Spike (this session): `@secretlint/core` 13.0.2 *can* scan strings, but its tree is heavy for a startup-perf-sensitive CLI. The regex layer is defense-in-depth (path allowlist + LLM redaction back it), so it needn't be exhaustive — the lean vendored set wins, swappable later via the seam |
| Email/URL/IP scrub | Small in-house regex | A library | Stable formats; not worth a dependency |
| Path scrub | In-house `safewordInternalTail` allowlist | A generic denylist library | Allowlist > denylist; already battle-tested in the spool |
| Semantic PII (names, company) | The independent LLM redaction pass (already planned) | Presidio NLP | Presidio is Python-only + heavy; the LLM pass covers names without a new runtime |
| Occurrence ledger | Single retro-maintained marker comment (`<!-- retro-ledger -->`) edited per session, idempotency key = session id | 👍 reactions (no metadata); issue labels (too coarse) | Only the marker comment is rich enough for per-harness/version counts |
| Signature namespace | `retro:<hash>` prefix | Reuse spool `signatureOf` | Must never collide with spool signatures (SM1.AC1) |
| Transcript scope | Claude Code JSONL only (this slice) | Multi-harness now | Codex/Cursor shapes deferred; keep the slice small |

## Arch alignment

- **Self-report deny-by-default sanitization** (`self-report.ts` security model) — retro reuses its allowlist posture (`safewordInternalTail`, `sanitizeToken`) and the `{signature,title,body,labels}` draft shape rather than inventing a parallel one.
- **Reusable "friction → safe issue" core** — retro is the first consumer (spec design note); the deterministic spool and a future conversational `safeword report` surface share the same egress core.

## Known deviations

- **Autonomy without sanitize-at-capture.** The spool is allowlist-sanitized at
  capture; retro's input (transcript) is raw, so it sanitizes at egress instead,
  via constrained schema + deny-list scrub + redaction pass + code-owned write.
  Accepted deviation: the user requires autonomy; this is the strongest guard
  short of a human, with the residual-risk tradeoff recorded in spec.md.

## Assessment triggers

- A real customer-data leak (or near-miss) in a filed issue → revisit whether
  autonomy is acceptable without a human gate, or tighten the scrub library/schema.
- Adding the SessionEnd auto-trigger or the conversational `safeword report`
  surface → re-evaluate that the egress core is genuinely shared, not forked.
- Supporting Codex/Cursor transcripts → re-evaluate the JSONL-only reader.
- Scrub-library deprecation or a missed key-format class → revisit the row-3 dependency.
