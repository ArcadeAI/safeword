# Dimensions: Retro runtime context

| Dimension | Partitions and boundaries |
| --- | --- |
| Project identity lifecycle | absent on install; valid on reinstall/upgrade; malformed on install |
| Harness | Claude Code; Codex; Cursor |
| Host classification | every new producer reports `unknown`; released `local` remains accepted; exact classification deferred to #3430 |
| Optional metadata | present and valid; absent/blank; control characters; 256 UTF-8 bytes; 257 UTF-8 bytes |
| Repository | credential-free supported remote; credential-bearing supported remote; local/file remote; malformed remote |
| Derivation outcome | complete; one field fails; all optional fields unavailable |
| Collector compatibility | widened current `v1` envelope; released valid `v1` envelope; unknown source field; missing or malformed required source field |
| Duplicate identity | same session with changed metadata; distinct harness/project/session |
| Delivery boundary | existing CLI path; known cloud evidence; no runnable public carrier |

Unsupported harnesses are outside this feature: the public contract remains
closed to Claude Code, Codex, and Cursor rather than inventing an `other` value.
Exact cloud classification and carrier readiness are outside this feature and tracked in issue #3430.

The acceptance scenarios use representative partitions. Exhaustive malformed
string, remote, and envelope matrices belong in lower-level table-driven tests.
