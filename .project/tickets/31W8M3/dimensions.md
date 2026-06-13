# Dimensions: Acceptance Criteria layer (31W8M3)

Derived from scope + done_when, plus the JTBD-gate precedent the AC gate mirrors.

| Dimension            | Partitions                                                          |
| -------------------- | ------------------------------------------------------------------- |
| Per-JTBD AC presence | ≥1 AC · zero ACs (no skip) · `skip: <reason>` · `skip:` (empty)     |
| JTBD section state   | has JTBD entries · whole-section `skip:` (no entries)               |
| spec.md presence     | present → gate applies · absent → grandfathered, gate does not fire |
| Template scaffolding | real AC heading · HTML-commented example AC (must be ignored)       |

## Notable partitions from domain knowledge

- **Commented example ACs** — the shipped spec-template carries an HTML-commented
  AC example; the parser must skip it (mirrors `parseJtbdSection`'s comment skip),
  else every fresh spec.md would falsely "pass" on the example.
- **Per-JTBD, not any-JTBD** — two JTBDs where only one has ACs must DENY; the gate
  is per-entry, like "≥1 AC under _each_ JTBD".
- **AC content quality** (capability-not-implementation, split-test, ~10-scenario
  split) is conversational coaching in DISCOVERY.md, NOT a hard gate — out of the
  testable scenario set by design.
