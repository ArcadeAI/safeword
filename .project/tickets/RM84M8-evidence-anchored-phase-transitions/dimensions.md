# Dimensions: evidence-anchored phase transitions (RM84M8)

Derived from spec.md (SM1.AC1/AC2, done_when) + domain knowledge (ledger `checkSha` format/resolve split; phase-provenance transition semantics).

| Dimension           | Partitions                                                                                                          | AC        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| Anchor presence     | entered phase has a `phase_anchors` entry; no `phase_anchors` key at all; key present but the entered phase absent | AC1 / AC2 |
| Anchor SHA validity | valid 7–40 hex; malformed (too short, too long, non-hex, empty)                                                    | AC2       |
| Reachability        | no resolver → format-only (write-time shape); resolver injected → reachable passes / unreachable fails             | AC2       |
| Transition kind     | forward one step; forward multi-step skip; backward move; re-declaration (same phase, no change)                  | AC1 / AC2 |
| Ticket type         | `feature` → policed; `task` / `patch` / `epic` / none → silent                                                    | AC2       |
| At-rest edit        | a ticket.md edit that does not change `phase:` (frontmatter repair, body edit) → silent                            | AC2       |

**Test layers:** AC1 + AC2 → **unit** — the pure `detectUnanchoredPhaseTransition(prior, proposed, resolveSha?)` and the anchor parser, asserting the verdict against fixtures (co-located in `packages/cli/tests/hooks/`, alongside `phase-provenance.test.ts`; inject a stub `ShaResolver` for the reachability partitions, mirroring `ledger-validation.test.ts`). No command or integration layer — #809 ships no blocking caller; enforcement wiring is #810.

**Baked decisions (from /figure-it-out + /quality-review, recorded in ticket.md Design Decision):**

- SHA-per-transition, channel implicit; reachability enforced at #810's boundary, not write-time.
- `phase_anchors` is an appended per-phase block sequence (mirrors `phase_skips`), never an overwritten scalar.
- Detection reuses `isValidSha` + the `ShaResolver` shape + phase-provenance frontmatter/skip parsers — no duplication.
