# Test definitions (R/G/R ledger) — AXRC4D

Two surfaces. The **done-gate nudge** is deterministic and carries the executable
R/G/R proof (`tests/hooks/architecture-document-nudge.test.ts`). The **`/audit`
structural reconciliation** is a skill-prompt sharpening — verified by reading the
instructions + cited evidence (safeword's precedent for skill changes; no
deterministic CLI surface to cucumber). Dimensions in dimensions.md.

## Done-gate nudge — unit + git-integration (executable acceptance)

`tests/hooks/architecture-document-nudge.test.ts` — pure decision + a git-backed
harness that builds a real repo (feature branch tracking `main`) and exercises the
actual `git show <merge-base>:…` base-resolution path.

- [x] **N1 — moved fingerprint + ARCHITECTURE.md → nudges** [J1.AC4, D3(b), D4(a), D7]
  - RED: no `architectureDocumentNudge*` existed; the done-gate emitted no advisory.
  - GREEN: working-tree generated-doc fingerprint ≠ base → nudge string returned.
- [x] **N2 — new/removed module (git-backed) → nudges** [J1.AC4, D3(b)]
  - git harness: baseline doc fp `base-fp` committed on `main`; feature branch sets
    working-tree fp `moved-fp` → `architectureDocumentNudgeForProject` nudges.
- [x] **N3 — in-sync / non-structural ticket → no nudge** [J1.AC5, D3(a)]
  - git harness: generated doc untouched (or only an unrelated README edit) → null.
- [x] **N4 — ARCHITECTURE.md absent → no nudge** [J1.AC5, D4(b)]
  - git harness: no `ARCHITECTURE.md` even though the fingerprint moved → null.
- [x] **pure — shape map newly introduced (no base doc) → nudges** [D3(c)]
- [x] **pure — no generated shape doc → no nudge** [D5(b)]
- [x] **pure — `parseGeneratedFingerprint`** valid / CRLF / no-frontmatter / empty-value / empty
  [feeds the trigger; the fingerprint is read, never recomputed]
- [x] **parity — `parseGeneratedFingerprint` ⇄ `readDocumentFingerprint`** differential
  (`architecture-document-nudge-parity.test.ts`, P58R22) [quality-review follow-up]: both
  readers agree on 9 fixtures, so the hook's re-implemented parser can't silently drift
  from the CLI writer's frontmatter format.

All RED-for-the-right-reason: before the helper existed, none of these signals
were produced; the done-gate marked tickets done with no architecture-doc advisory.

## `/audit` structural reconciliation — agent-lane (verified by reading)

Sharpened `ARCHITECTURE.md` check in `skills/audit/SKILL.md` (3 copies). Anchored
on `architecture.generated.md` as ground truth; report-only.

- [x] **A0 — in-sync → no structural finding** [D1(a)]: doc's module/layer set matches
  the generated `### <name>` units → no E003/W008/W009.
- [x] **A1 — orphaned → E003 (error)** [J1.AC1, D1(b)]: a documented module/layer absent
  from the generated map is flagged, citing the generated doc.
- [x] **A2 — missing → W008 (warn)** [J1.AC2, D1(c)]: a generated module/package the doc
  never mentions is flagged.
- [x] **A3 — drifted layer→dir → W009 (warn) + report-only invariant** [J1.AC3, D1(d), D2]:
  a Layers & Boundaries `directory` matching no generated module path is flagged; the
  instruction is explicit that it cites + proposes under human review and NEVER
  auto-overwrites prose or blocks.

Verification: the sharpened instructions read the generated doc (the deterministic
structural truth) and add the three codes; the "report only, never overwrite,
never block" guard is stated in-line. Not auto-run (skill prompt, agent judgment).

## Reconcile note

The honesty property = N1–N4 (the shape-moved nudge never false-alarms) + A1/A2
(audit surfaces orphaned/missing against the generated truth). No new deterministic
drift module and no managed region were introduced — the nudge reuses the existing
fingerprint as a cheap trigger; the audit reads the existing generated doc.
