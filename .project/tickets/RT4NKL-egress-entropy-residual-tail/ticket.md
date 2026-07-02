---
id: RT4NKL
slug: egress-entropy-residual-tail
parent: RV9JT4-retro-transcript-mining
type: task
phase: backlog
status: backlog
created: 2026-07-02T05:05:00.000Z
last_modified: 2026-07-02T05:05:00.000Z
scope: |
  Carry the documented false-negative tail of the retro egress entropy backstop
  (added in PR #601, egress.ts `looksHighEntropySecret`/`scrubHighEntropy`/
  `scrubNetworkLocators`). These are shapes the backstop deliberately does NOT
  redact today, accepted because they are thin and backstopped by secretlint +
  the regex blocklist, and because over-redaction is the safe direction so we did
  not chase them inline:
    - a bare pure-alpha token under ~4.2 bits (e.g. a 20-char lowercase random run)
    - a pure-digit secret (max entropy log2(10)=3.32, below the pure-alpha floor)
    - a canonical-UUID-shaped credential (exempted so request-ids survive)
    - a sub-20-char prefixless token (below the run length floor)
    - IPv6 addresses and internal TLDs beyond internal|local|corp|lan|intranet
      in `scrubNetworkLocators`
  SPNZKM (the durable secretlint-adoption ticket) is done, so nothing else tracks
  these. This ticket is the home for "revisit if a real leak in one of these
  shapes is observed, or if a maintained detector makes closing one cheap."
out_of_scope: |
  - The charset-aware tiers themselves — shipped and reviewed in #601.
  - Any change that redacts long code identifiers / dictionary words to close the
    pure-alpha tail (rejected: guts report usefulness; over-redaction of the
    report body was explicitly not wanted).
done_when: |
  - Either: a real-world leak in one of these shapes is observed, the specific
    shape is closed with a targeted rule + regression test, and the residual note
    at egress.ts is updated; OR
  - the tail is reaffirmed as permanently accepted (secretlint + blocklist cover
    real risk), and this ticket is closed wontfix with that rationale recorded.
---

# Egress entropy backstop: track the accepted false-negative tail

**Goal:** Give the retro egress backstop's documented residual false-negative tail
a tracked home now that its durable-fix ticket (SPNZKM) is done.

**Why:** The #601 review closed four leak categories with a charset-aware entropy
backstop, but a thin tail of shapes is deliberately left uncaught (pure-alpha
under ~4.2 bits, pure-digit, UUID-shaped, sub-20-char, IPv6 / non-listed internal
TLDs). It is documented in code at the `looksHighEntropySecret` call site and is
acceptably backstopped by secretlint + the blocklist — but with SPNZKM closed no
open ticket carries it. This keeps the accepted residual visible so a future real
leak or a cheap maintained-detector win has somewhere to land, rather than being
silently forgotten.

## Work Log

- 2026-07-02T05:05Z Created from the PR #601 egress-hardening review cycle. Backlog
  by design — no action unless a real leak in one of these shapes shows up, or
  closing one becomes cheap. Residual is documented at `egress.ts`
  (`looksHighEntropySecret` docblock) and backstopped by secretlint + the blocklist.
- 2026-07-02T22:19Z Mirrored to GitHub issue #621 (watch-only) for visibility now that
  SPNZKM is closed. Cheapest wins noted there: IPv6 + extra internal TLDs (no
  identifier-collision problem, unlike the entropy shapes).
