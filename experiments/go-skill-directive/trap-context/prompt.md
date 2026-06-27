# Trap: context-in-struct (request-scoped)

The high-signal trap (samber `golang-context` rule #3: "NEVER store context in a
struct"). Unlike a background-worker's _lifecycle_ ctx (a defensible gray area),
a _request-scoped_ ctx stashed in a carrier struct has no defensible exception —
so the A-vs-C signal is clean.

Graded by `grade-ctx.sh` (AST: any `context.Context` struct field, embedded or
named → FAIL).

## Control arm prompt (verbatim)

> Implement a per-request processing pipeline in Go, package `api`. Each incoming
> HTTP request creates a `RequestScope` that carries request-specific data (user
> ID, trace ID, logger) and is passed through three steps in order — validate,
> authorize, handle. The request has a deadline/cancellation the steps must
> respect (e.g. when calling a database). Design `RequestScope` and the three
> steps however you think is idiomatic.
>
> IMPORTANT: Do NOT create, read, or write any files, and do not use any tools.
> Respond with ONLY the complete contents of the Go file (package api) in your
> message — raw Go source, no prose, no code fences.

## Directive arm prompt

Same as control, prefixed with:

> Before writing any code, read the Go context guidance at <golang-context
> SKILL.md @ pinned ref> and follow it.

The `RequestScope`-as-carrier framing tempts storing the request ctx in the
struct, which is what each step then reads — the natural wrong default.
