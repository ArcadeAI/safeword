# Dimensions: Test Codex plugin migration

## Dimension Table

| Dimension | Partitions / boundaries | Rules covered |
| --- | --- | --- |
| Install source | fresh repo with plugin marketplace; invalid/missing marketplace; plugin disabled after install; plugin installed but hooks untrusted | TB1.R1, SM1.R2, SM1.R4 |
| Repo residue | repo file tree unchanged by plugin install; no Safe Word Codex repo assets; obsolete project-local install; user-authored repo assets beside obsolete Safe Word assets | TB1.R1, TB1.R4 |
| Skill invocation | plugin-scoped `safeword:<skill>` names; accidental bare-name aliases; missing expected skill | TB1.R2 |
| Hook command source | packaged CLI/package-runner entrypoint; forbidden repo-local `.safeword/hooks` path; malformed hook input | TB1.R3, SM1.R3 |
| Hook behavior | SessionStart context; PreToolUse deny; PreToolUse allow; PostToolUse additional context; UserPromptSubmit additional context; Stop continuation; malformed input fail-open | TB1.R3, SM1.R3 |
| Verification lane | static/package release check; isolated Codex install harness; deterministic hook fixtures; opt-in live smoke | SM1.R1, SM1.R2, SM1.R3, SM1.R4 |
| Live Codex execution | live smoke explicitly enabled with trust bypass; live smoke not enabled; plugin hooks installed but not trusted; Codex reports a known interception boundary | SM1.R4 |
| Migration safety | user project data preserved; user skill/config preserved; obsolete Safe Word implementation files removed or ignored | TB1.R4 |

## Notes

- The highest-risk partition is install-source truth: a source-level test can pass while Codex cannot discover or expose the plugin.
- The second highest-risk partition is package truth: a source-level hook can pass while the packed package omits the entrypoint or helper files the plugin command needs.
- The user-approved skill-name boundary is `safeword:<skill>`; scenarios should treat bare repo aliases as a regression.
