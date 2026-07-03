# Dimensions: Filer ack + bare-drain tripwire (GH644A)

| Dimension | Partitions / boundaries | Scenarios |
| --- | --- | --- |
| Ack file state | absent; all dispatched signatures acked; partial acks; malformed/torn lines (skipped); shape-invalid entries | acked drain silent; partial bare drain trips; fail-open reads |
| Spool vs snapshot delta | all dispatched signatures still spooled (no removal); some removed; all removed; spool file deleted entirely | trip on unacked removal; silent while still spooled |
| Marker generations | GH628F marker (no `signatures`); new marker with snapshot; missing marker; corrupt marker | pre-upgrade fails open |
| Tripwire idempotency | first detection; repeat evaluation same batch (`tripwired` set); new batch after re-arm | fires once per batch |
| Config toggles | `selfReport.capture` on/off (tripwire keys on capture, not file) | capture-off silent |
| Signal payload | allowlist-only fields (errorClass RetroBareDrain, source token); dedup via `signatureOf` | signal shape pinned |
| Conversation surface | tripwire path emits nothing; dispatch/silence decision unchanged same evaluation | invisibility scenario |
| Filing seam | `fileSpooledDrafts` posts→ack→drain ordering; post throws → no ack, stays spooled | reference seam writes acks |
| Shipped prompts | dispatch text prohibition; filer md/toml ack instructions; guide fallback | agent-definition assertions |

Out of scope (ticket): network verification of issue numbers, tamper-proof
attestation, retro-spool self-referential loss reports (rejected in
figure-it-out — loop risk).
