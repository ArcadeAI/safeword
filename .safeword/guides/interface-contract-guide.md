# Interface and Access Decision Guide

Use during Implementation Planning when a feature adds or changes an API, event,
command, tool, shared function contract, or user-visible permission boundary.
The plan owns the decisions; this guide helps find them. Follow the project's
existing protocol and conventions rather than imposing REST, RPC, or another
style. If no shared interface or access rule changes, record a short reason and
move on.

## Make the contract concrete

Start with one representative caller and request. Name the entry point, caller,
resource, operation, inputs, successful output or side effect, and every
consumer whose expectations may change. For each consequential variant, decide:

- Who is allowed to call it, on which resource, and whether the decision uses
  current permissions or a snapshot. Check access to individual objects and
  sensitive fields as well as the route or tool itself.
- Which inputs are valid, which are rejected, and which failures a caller can
  distinguish and recover from. Include the system's behavior when a dependency
  is unavailable or a request is repeated.
- Whether operations are idempotent, how duplicate or concurrent requests
  behave, and which side effects may have occurred when a response is lost.
- How existing consumers behave during a change: old and new request shapes,
  response fields, error meanings, rollout overlap, and deprecation or removal.

Record the chosen contract, its alternative, the reason for the choice, and
the consequence for each affected consumer in `impl-plan.md`. Include a compact
example or link to subordinate protocol detail when it clarifies a decision.
Put exact files, code steps, generated clients, and test commands in the
Execution Plan. A public or shared contract that changes across features may
also need a linked durable architecture decision.

## Check the boundary that matters

Trace a request from the real entry point through authorization to the
resource or side effect. A passing service-unit test cannot prove that the
gateway, transport, or client invokes the same policy. Choose proof that would
fail if that wiring were absent; use the testing guide to choose its scope.

If the work changes persisted data, use the data architecture guide for its
source of truth, lifecycle, and migration decisions. This guide does not
duplicate those decisions.

**Example:** A new resource-read operation reuses the tool-access policy. The
plan must decide whether a user who loses tool access loses resource access on
the next request, what unauthorized reads return, and how both transports
reach the same policy. The Execution Plan names the functions and tests.

## Sources and fit

- [Google Cloud API Design Guide](https://docs.cloud.google.com/apis/design)
  covers interface shape, errors, versioning, and compatibility for networked
  APIs. Its resource-oriented conventions are examples, not Safeword defaults.
- [OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0x00-header/)
  identifies object and property authorization as distinct API risks. Use it
  to challenge the chosen trust boundary, not as a substitute for the project's
  own access policy.
