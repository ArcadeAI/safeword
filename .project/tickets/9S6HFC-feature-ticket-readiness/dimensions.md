# Dimensions: Validate feature ticket readiness before define-behavior

Readiness varies across the artifact that is missing, how the ticket reaches
define-behavior, and ticket type. Scenarios cover the behaviorally distinct
partitions rather than the full cross-product.

| Dimension | Partitions | Notes |
| --- | --- | --- |
| Transition path | phase edit into `define-behavior` . legacy resume already in `define-behavior` | New bad state must be blocked; old bad state must be surfaced upfront |
| Missing readiness item | scope fields . `spec.md` missing . JTBD/AC invalid . `dimensions.md` missing . empty `skip:` . none missing | Matches the late `test-definitions.md` gate's required inputs |
| Ticket type | feature . task/patch | Only feature tickets require the readiness artifacts |
| Hook surface | PreToolUse edit denial . UserPromptSubmit context line | Hard prevention for entry; visible remediation for resume |
| Message shape | single combined report . normal reminder | Missing items should be grouped so agents can repair once |

The load-bearing boundary is "feature at define-behavior": readiness matters
there, but not for task/patch tickets or already-ready feature tickets.
