# Dimensions: Codex Agents Config Generation

| Dimension         | Partitions                                                                         | Boundary / Notes                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Install state     | Fresh setup; upgrade with missing Codex assets; upgrade with existing Codex config | Fresh setup should create everything. Existing user config must not be overwritten.                      |
| Codex asset class | `AGENTS.md`; `.codex/config.toml`; `.agents/skills`; hook adapter templates        | AGENTS already exists via text patch; this ticket adds config and skills generation.                     |
| Hook coverage     | Implemented PreToolUse adapter; future prompt-submit/stop adapters                 | Wire only implemented adapters; leave future gates documented but not broken.                            |
| Trust state       | Generated but untrusted; reviewed/trusted by user                                  | Project-local hooks may not run until trusted, so setup output/docs must not imply immediate activation. |

## Decisions Baked In

- Use managed `.codex/config.toml` so safeword creates the file but does not clobber user Codex config.
- Reuse existing skill templates for `.agents/skills`.
- Treat AGENTS.md as already handled by safeword's root text patch.
