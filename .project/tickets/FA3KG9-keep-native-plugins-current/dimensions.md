# Behavioral dimensions

| Dimension | Partitions and boundaries |
| --- | --- |
| Host and lifecycle | Claude startup update, Claude current-session reload, Codex startup refresh |
| Selected channel | stable, exact stable tag, prerelease tag, default branch |
| Update result | success, unavailable network, invalid candidate, host opt-out |
| Project history | fresh native install, recognized legacy install, customized or ambiguous legacy install |
| Profile state | enrolled and proven, installed but not loaded, absent, enrollment failure, stale or foreign proof |
| Collaboration | one task, two tasks sharing a profile, two profiles sharing a repository |
| Release ordering | successful stable publish, prerelease, failed publish, newer release finishing before an older release |
| Configuration trust | official declaration, third-party lookalike, malformed declaration, newer exact pin |

Boundary focus: a newly installed Codex plugin cannot become active inside the task that installed it. The task must warn without blocking, and the next task must become quiet only after exact native proof.
