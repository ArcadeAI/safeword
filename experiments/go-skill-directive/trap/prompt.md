You are working on a Go HTTP service.

Implement a request hit-counter in package `counter`. Provide exactly:

- `func New() *Counter`
- `func (c *Counter) Inc()` // record one hit
- `func (c *Counter) Count() int` // total hits so far

The HTTP handler calls `Inc()` on every incoming request, and an admin endpoint
calls `Count()` to display the total.

Output ONLY the complete contents of `counter.go` (package `counter`), nothing else —
no prose, no code fences, just the Go source.
