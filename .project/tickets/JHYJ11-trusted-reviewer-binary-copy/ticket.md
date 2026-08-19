---
id: JHYJ11
slug: trusted-reviewer-binary-copy
type: task
phase: intake
status: in_progress
created: 2026-08-18T23:49:45.905Z
last_modified: 2026-08-18T23:49:45.905Z
---

# Let independent review trust Homebrew-installed reviewer binaries

**Goal:** When the resolved reviewer binary (e.g. codex) sits in a group-writable directory (the Homebrew cask default), make a private safeword-owned copy in a non-group-writable directory and review from that instead of falling back to a degraded same-agent review

**Why:** Codex's officially-documented install method (Homebrew cask) puts the binary under /opt/homebrew, which is group-writable by default -- so a large fraction of customers who followed the standard install instructions get silently downgraded to same-agent (non-independent) review, defeating the point of the independent-review architecture, without any indication anything is wrong beyond a REVIEW_INDEPENDENCE_DEGRADED finding most people won't notice. Discovered while running an independent review on PR #3178 (0VG5AC).

## Work Log

- 2026-08-18T23:49:45.905Z Started: Created ticket JHYJ11
