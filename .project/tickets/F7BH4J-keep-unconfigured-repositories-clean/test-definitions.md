# Test Definitions: Keep unconfigured repositories clean for Codex users

## Rule: Profile installation does not enroll repositories

### Scenario: Ordinary tool use leaves an unconfigured repository unchanged

Given a committed Git repository without `.safeword/` or a namespace root,
when the packaged Codex `PostToolUse` hook observes a successful Bash tool,
then the hook exits successfully and creates no files or directories.

### Scenario: Project gates fail open before enrollment

Given an unconfigured repository and a command that an enrolled-project gate
would deny,
when the packaged Codex `PreToolUse` hook runs,
then it allows the command and creates no files or directories.

### Scenario: Session start remains useful before project enrollment

Given an unconfigured repository and the profile plugin,
when the packaged Codex `SessionStart` hook runs,
then it returns the package-owned Safeword instructions and creates no
repository files or directories.

## Rule: Setup enables project-scoped hook state

### Scenario: An enrolled default-root project receives hook state

Given a repository containing the Safeword enrollment marker and `.project/`,
when the packaged Codex `PostToolUse` hook observes a successful Bash tool,
then it writes the session quality-state file under `.project/`.

### Scenario: Enrolled projects honor namespace compatibility

Given an enrolled repository using either the legacy namespace or a configured
custom namespace root,
when the packaged Codex `PostToolUse` hook observes a successful Bash tool,
then it writes the session quality-state file under the resolved namespace and
does not create `.project/`.
