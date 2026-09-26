---
id: 1ZAJB3
slug: keep-developer-commands-on-pinned-tools
type: patch
phase: intake
status: in_progress
created: 2026-09-26T09:00:48.400Z
last_modified: 2026-09-26T09:00:48.400Z
---

# Keep developer commands on pinned tools

**Goal:** Select the repository Bun and Node pins in developer commands and Git hooks without personal shell changes.

**Why:** Global tool directories repeatedly outranked the repository pins in non-interactive shells.

## Work Log

- 2026-09-26T09:00:48.400Z Started: Created ticket 1ZAJB3

## Scope

Use the repository Bun and Node pins for developer commands and Git hooks.
Keep arguments, working directory, PATH tail and exit status intact; explain
missing mise or missing pinned runtimes. This is a separate user-requested
repair alongside epic #4200, not a change to planning or review authority.

Out of scope: changing personal shell profiles, upgrading pinned versions,
pinning other language tools, changing installed customer-project hooks, and
promoting or merging pull requests.

## Verification and current review

The isolated branch passed 15 targeted tests and a Homebrew-first PATH smoke
selected Bun 1.3.14 and Node 24.18.1. The schema push gate passed 894 tests.
Review c7e32230-ffca-4033-9da8-8ca8cb597503 approved its then-current packet;
shell formatting subsequently made that receipt stale.

Final-byte review c545bca9-3ec3-4114-8d5a-a6c8d16d7d1a requested changes for
one actual error: the pinned Bun/Node fixture shared a directory, so a missing
Node lookup could pass. The fixture now uses separate install directories and
asserts their exact order. The corrected 15-test targeted run passes. A deliberate mutation that replaces
the Node lookup with a second Bun lookup fails the corrected fixture; the
original launcher was restored in a finally block. The mutation result is
retained at `/tmp/4200-toolchain-node-lookup-mutation.log`. Draft PR #4990
remains unpromoted; no final approval of the corrected bytes is claimed.

- Full D1 verification exposed another Bun-related repo-test dependency: the hierarchy hook fixture fell through to published `bunx safeword` and hit an incomplete temporary ESLint cache. The unchanged isolated test then passed all six cases, so the failed full result is retained as intermittent. Bind that fixture to the repository’s actual built CLI via the existing `SAFEWORD_CLI` override; no hook behavior or assertions change, and no cache deletion or personal configuration is required. Fresh scoped tests/review are required for this fixture correction.

- Fixture correction verification: all 21 targeted tests in four files pass. Removing the local CLI binding while making published `bunx` unavailable fails all six hierarchy assertions; restored the real built-CLI binding afterward. Both deliberate mutations are retained as evidence, not normal failures of the final code.

- The next complete D1 run retained **10,573 passed, 2 failed, 13 skipped**. Both failures were other source-hook fixtures invoking published `bunx safeword`; Bun reported dependency-link EEXIST errors in the shared temporary cache. Centralize the existing local-CLI binding in the source-hook test environment helper, use it in the shared hook runner, hierarchy fixture, and Codex stop/post-tool fixture, and preserve explicit caller CLI/environment overrides. Consumer hooks, installed-CLI resolution policy, assertions, and global Vitest environment remain unchanged. Fresh scoped tests and review are required.

- Shared fixture verification: **87 passed in six files**. Deliberately removing the shared local-CLI default and making published `bunx` unavailable produced **15 failures, 57 passes across the 72 hook cases**; the original helper was restored. All assertions and scenarios remain enabled. The shared helper preserves explicitly supplied environment/CLI overrides and does not set a global Vitest CLI binding.
