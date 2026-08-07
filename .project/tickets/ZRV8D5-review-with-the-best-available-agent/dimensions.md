# Dimensions: Keep review available with the best supported fallback

| Dimension | Partitions and boundaries |
| --- | --- |
| Independent availability | first opposite reviewer succeeds · first fails and another succeeds · none completes |
| Degraded availability | same-agent headless · host-native fresh-context · main thread only |
| Host environment | local with external CLIs · cloud with host agent only · cloud without a host reviewer |
| Route outcome | completes · unavailable · fails and advances once · every delegated route fails |
| Assurance | independent · separate-process degraded · fresh-context degraded · self-review |
| Policy | `prefer` accepts degraded findings · `require` retains findings but remains unsatisfied |
| Packet trust | ordinary material · hostile repository instruction · failed route emits diagnostics or secrets |
| Surface | Claude local/cloud · Codex local/cloud · Cursor local/cloud · CLI coordinator boundary |

Twenty-six scenarios cover independent success and fallback, each degraded rung,
the headless-to-host transition, three terminal non-exhaustion outcomes, hostile-input
and ambient-context boundaries, distinct assurance wording, and both outcomes
of required-review policy, the positive exhaustion trigger, and hostile text in
the terminal self-review, invalid in-session and terminal findings, truthful
ambient-context disclosure, an empty self-review, an unrecognized coordinator
failure, both degraded verdicts, cloud without delegation, and attempted
assurance forgery from hostile packet text.
