# Behavioral Dimensions: phase-work-log-stamp (E32M4P)

| Dimension            | Partitions                                                                                                              | Notes                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Edit payload shape   | Edit (old/new strings) · MultiEdit (edits array) · Write (full content) · non-edit tools                                 | Edit/MultiEdit are stampable; Write carries no prior content post-hoc → documented no-op   |
| Phase change kind    | forward advance · backward move · re-declaration (same value) · phase introduced (no `phase:` in old payload)            | Any from≠to change stamps (backward rework is history too); same-value and introduce don't |
| Target file          | ticket.md under tickets namespace · ticket.md outside namespace · other files (spec.md, code)                             | Only namespace ticket.md is observed                                                       |
| Work Log section     | `## Work Log` present · absent                                                                                            | Present → append at end; absent → create section then append                               |
| Ticket type          | feature · task · patch · epic                                                                                             | Stamp is type-agnostic: any ticket.md phase change is history worth real time              |
| Stamp count          | one edit = one stamp · repeated legitimate transitions (A→B→A→B) = one stamp each                                         | Idempotency is per-edit (PostToolUse fires once per landed edit), not per-transition-pair  |
