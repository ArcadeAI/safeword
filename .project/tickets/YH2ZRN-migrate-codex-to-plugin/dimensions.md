# Behavior Dimensions

| Dimension | Partitions | Boundary / risk covered |
| --- | --- | --- |
| Invocation | `setup`, `upgrade`, explicit migration | Normal commands must not make profile changes or remove protection. |
| Plugin state | Bun/Codex missing, marketplace failure, installed-enabled | Project cleanup occurs only after exact enabled verification. |
| Project config ownership | Safe Word-only stanzas, mixed Safe Word/custom stanzas, no Safe Word stanzas | Remove only managed hooks and preserve all user content. |
| Release contract | source manifest, packed artifact, real isolated profile | No `npx`, exact Bunx version, real Codex acceptance. |
