# Dimensions: Split large contributions into independently reviewable PRs

| Dimension | Partitions and boundaries |
| --- | --- |
| Slicing decision | one coherent PR; multiple dependent PRs; no recorded decision |
| Slice completeness | purpose, boundary, prerequisites, proof, and completion signal present; one or more missing |
| Dependency safety | every intermediate merge is supported; an earlier merge depends on later work to remain valid |
| Reviewability | one large mechanical concern; multiple small but independent concerns; line or file count used as the only criterion |
| Obligation preservation | behavior, migration, rollout, rollback, documentation, and affected surfaces all assigned; an accepted obligation disappears between slices |
| Host parity | skip: YCFFNC in M2 owns installed Claude Code, OpenAI Codex, OpenCode, and Cursor parity; M1 proves the Safeword CLI contract only |
