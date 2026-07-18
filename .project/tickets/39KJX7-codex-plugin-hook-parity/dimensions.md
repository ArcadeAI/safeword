# Dimensions: Codex plugin hook parity

| Dimension | Partitions | Covered by |
| --- | --- | --- |
| Codex event | PreToolUse; PostToolUse; Stop; SessionStart; UserPromptSubmit; manifest/live install | TB1.R1, TB1.R2, TB1.R3, TB1.R4, TB1.R5, SM1.R2, SM1.R3 |
| Delivery path | Packaged CLI command; hidden compatibility alias; plugin manifest command; isolated live Codex run | TB1.R1-TB1.R5, SM1.R2, SM1.R3 |
| Input shape | apply_patch edit; shell/proof command; malformed JSON; Stop transcript payload; auto-upgrade outcome | TB1.R1, TB1.R2, TB1.R3, TB1.R4 |
| Output shape | PreToolUse deny JSON; PostToolUse additionalContext; Stop block continuation; Stop no-continuation `{}`; SessionStart additionalContext | TB1.R1-TB1.R4 |
| State side effect | Run identity bridge; review-stamp bridge; quality state; retro offset/drafts; no customer repo implementation files | TB1.R1, TB1.R2, TB1.R3, SM1.R3 |
| Failure mode | Missing intake fields; malformed hook input; multiple continuation candidates; untrusted/live plugin boundary; package-vs-repo path drift | TB1.R1, TB1.R3, SM1.R1, SM1.R2, SM1.R3 |
| Proof layer | Static audit; deterministic subprocess/integration test; opt-in live smoke | SM1.R1, SM1.R2, SM1.R3 |
