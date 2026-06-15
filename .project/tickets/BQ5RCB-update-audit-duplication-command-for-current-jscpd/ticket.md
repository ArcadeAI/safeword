---
id: BQ5RCB
slug: update-audit-duplication-command-for-current-jscpd
type: patch
phase: intake
status: in_progress
created: 2026-06-15T13:52:20.271Z
last_modified: 2026-06-15T13:52:44Z
---

# Update audit duplication command for current jscpd

**Goal:** Update the audit duplication command so it works with the currently resolved `jscpd` CLI.

**Why:** `/audit` should not fail before duplication analysis because its documented command uses a removed flag.

**Scope:** Replace the unsupported `--gitignore` argument with the current equivalent behavior, relying on the current CLI's default gitignore handling or another supported flag.

**Out of Scope:** Tuning which duplication findings count as signal; that belongs to `make-duplication-audit-signal-useful (0N7CQ9)`.

**Done When:**

- [ ] The audit duplication command runs without an argument parsing error.
- [ ] The command still respects gitignored files.
- [ ] The command change is applied to templates as well as dogfood copies if needed.

## Work Log

- 2026-06-15T13:52:20.271Z Started: Created ticket BQ5RCB
- 2026-06-15T13:52:44Z Intake: Audit command `bunx jscpd . --gitignore --min-lines 10 --reporters console` failed with `unexpected argument '--gitignore'`; current `jscpd --help` shows gitignore is default and only exposes `--no-gitignore`.
