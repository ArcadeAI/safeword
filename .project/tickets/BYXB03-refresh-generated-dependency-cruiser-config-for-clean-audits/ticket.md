---
id: BYXB03
slug: refresh-generated-dependency-cruiser-config-for-clean-audits
type: patch
phase: intake
status: in_progress
created: 2026-06-15T13:52:10.776Z
last_modified: 2026-06-15T14:49:38Z
---

# Distinguish local dependency-cruiser config sync from published-latest drift

**Goal:** Ensure depcruise config drift checks use the intended Safeword source, and do not report branch-local config as stale when only the published CLI differs.

**Why:** `/audit` reported stale `.safeword/depcruise-config.cjs` via `bunx safeword@latest`, but the branch-local CLI reports the generated config is already current. That false split makes migration-specific audit output noisy.

**Scope:** Compare branch-local sync-config behavior with published `safeword@latest`, refresh generated config only if the branch-local source reports drift, and document whether audit should prefer local source while dogfooding.

**Out of Scope:** Changing dependency-cruiser rules by hand or altering the architecture policy.

**Done When:**

- [x] `bun packages/cli/src/cli.ts sync-config --check` reports the generated config is current.
- [x] `bun run deps` reports no dependency violations.
- [x] Published-latest drift behavior is documented if it differs from branch-local behavior.
- [ ] Audit guidance decides whether dogfood checks should use branch-local Safeword or published `safeword@latest`.

## Work Log

- 2026-06-15T13:52:10.776Z Started: Created ticket BYXB03
- 2026-06-15T13:52:44Z Intake: Audit reported `Stale .safeword/depcruise-config.cjs — run safeword sync-config to refresh`.
- 2026-06-15T14:49:38Z Revalidated branch-local source: `bun packages/cli/src/cli.ts sync-config --check` passed with `✓ Config in sync`.
- 2026-06-15T14:49:38Z Revalidated published source: `bunx safeword@latest sync-config --check` still reports `Stale .safeword/depcruise-config.cjs`, so the warning is published-version drift, not branch-local generated-config drift.
- 2026-06-15T14:49:38Z Revalidated dependency policy: `bun run deps` passed with no dependency violations. No generated config diff is needed for the React plugin PR.
