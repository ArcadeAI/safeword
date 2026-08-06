# Dimensions: Always return the best available review

| Dimension | Partitions and boundaries |
| --- | --- |
| Independent availability | first opposite reviewer succeeds · first fails and another succeeds · none completes |
| Degraded availability | same-agent headless · host-native fresh-context · main thread only |
| Host environment | local with external CLIs · cloud with host agent only |
| Route outcome | completes · unavailable · fails and advances once · every delegated route fails |
| Assurance | independent · separate-process degraded · fresh-context degraded · self-review |
| Policy | `prefer` accepts degraded findings · `require` retains findings but remains unsatisfied |
| Packet trust | ordinary material · hostile repository instruction · failed route emits diagnostics or secrets |
| Surface | Claude local/cloud · Codex local/cloud · Cursor local/cloud · CLI coordinator boundary |

Nine scenarios cover independent success and fallback, each degraded rung, the
hostile-input boundary, and both outcomes of required-review policy.
