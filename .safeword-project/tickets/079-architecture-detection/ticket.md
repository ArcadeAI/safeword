---
id: '079'
slug: architecture-detection
title: 'Architecture File Detection & Generation During Setup'
type: Improvement
status: in_progress
---

# Task: Architecture File Detection & Generation During Setup

**Type:** Improvement

**Scope:** During `safeword setup`, detect if the target project already has an architecture doc. If none exists, kick off a sub-agent to scan the codebase and generate one. The reference to the architecture file should live in the customer's CLAUDE.md/AGENTS.md (not in `.safeword/`) to avoid conflict or drift with safeword-managed files.

**Out of Scope:** Changing existing SAFEWORD.md content, modifying how `.safeword/` templates work, changing the prepend/patch strategy for CLAUDE.md.

**Context:** Discovered during dogfooding on ArcadeAI/monorepo. The ArcadeAI repo already had `docs/agents/docs/architecture.md` referenced in their CLAUDE.md, which safeword correctly preserved. But repos without an architecture doc get no architecture context at all — safeword should fill that gap.

## Design

**Phase 1 — Detect existing architecture doc:**

Scan common paths: `ARCHITECTURE.md`, `docs/architecture.md`, `docs/ARCHITECTURE.md`, `docs/agents/*/architecture.md`. Simple glob, no LLM needed.

**Phase 2 — Generate if missing:**

Kick off a sub-agent (LLM call) that reads the codebase and writes a real architecture doc. This is NOT template-filling — it requires the agent to understand the project's structure, patterns, and boundaries. The existing `buildArchitecture()` in `sync-config.ts` already detects workspaces/elements and can seed the agent's context.

**Open questions:**

- How does the CLI invoke an LLM during setup? Does it shell out to `claude` CLI, use the API directly, or defer generation to the user's next agent session?
- Cost/latency tradeoffs — generating a good architecture doc may take 30-60s
- Should this be opt-in (`safeword setup --generate-architecture`) or prompted interactively?

**Phase 3 — Link from customer-owned file:**

Add `---@./ARCHITECTURE.md` (or detected path) to the customer's AGENTS.md via the existing textPatch system. The reference lives in customer space, not `.safeword/`. The architecture doc itself is customer-owned and editable.

**Note:** `buildArchitecture()` in `sync-config.ts` already exists for dependency-cruiser config generation. Architecture _doc_ detection is a separate, simpler concern — don't conflate the two.

## Implementation Plan

1. Add architecture doc detection to setup flow (glob for common paths)
2. Add linking logic (textPatch reference in AGENTS.md)
3. Design the generation strategy (open questions above)
4. Implement generation (depends on strategy decision)
5. Add tests for detection and linking paths

## Files

- `packages/cli/src/commands/setup.ts` — add detection + linking orchestration
- `packages/cli/src/utils/architecture-doc.ts` — new: detect existing architecture docs (simple glob)
- `packages/cli/src/schema.ts` — update textPatches for AGENTS.md architecture linking
- `packages/cli/tests/architecture-doc.test.ts` — new: detection + linking tests

**Done When:**

- [ ] `safeword setup` detects existing architecture docs and skips generation
- [ ] `safeword setup` generates architecture doc when none exists
- [ ] Generated doc is written to customer-owned location (not `.safeword/`)
- [ ] Reference is linked from customer's AGENTS.md
- [ ] Tests cover detection, generation, and linking paths
