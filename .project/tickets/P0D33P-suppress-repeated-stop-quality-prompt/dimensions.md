# Behavioral dimensions — P0D33P

| Dimension | Partitions | Scenario decision |
| --- | --- | --- |
| Decision brief completeness | Complete / missing required field | One acceptance and one rejection path are required. |
| Verdict form | CONFIDENT / BLOCKED | Both complete forms must be accepted; their required labels differ. |
| Stop path | Non-done quality review / done hard gate / Cursor or Codex adapter | Exercise the non-done Claude hook only; preserve the other paths by explicit scope and existing tests. |

No additional partition is needed for a no-edit stop: it exits before quality review today and this ticket does not change that gate.
