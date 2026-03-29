# Task: Bump golangci-lint from v2.10.1 to v2.11.4

**Type:** Micro

**Scope:** Update the pinned golangci-lint version in `ci.yml` from v2.10.1 to v2.11.4. Dependabot doesn't cover curl-installed binaries, so this requires a manual bump.

**Out of Scope:** Changing the install method, updating golangci-lint config, upgrading to a future v3.

**Done When:**

- [ ] golangci-lint version in ci.yml updated to v2.11.4
- [ ] CI passes

**Tests:**

- [ ] Existing tests pass (no new test needed)

## Work Log

- 2026-03-29 Created. Found during quality review of CI hardening work. v2.10.1 (2026-02-17) is 4 minor versions behind v2.11.4 (2026-03-22). Note: Dependabot can't auto-bump this since it's installed via `curl | sh`, not a package manager.
