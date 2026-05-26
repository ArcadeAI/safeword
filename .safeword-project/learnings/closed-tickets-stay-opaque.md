# Closed tickets stay opaque

**Covers:** ticket folder retrofits, mass-renames, `.safeword-project/tickets/completed/`, scope of legibility changes.

## Decision

When changing the on-disk format of ticket folders (e.g. PR #160's `{ID}/` → `{ID}-{slug}/`), retrofit **only open tickets**. Leave done/completed tickets in their as-shipped shape.

## Why

The legibility goal is for **active work surfacing** — you scan `tickets/` to find what you're working on now. Done tickets in `tickets/completed/` are accessed by known ID, not by browsing. The cost of a mass-rename commit (review noise, git history churn, blame readability) is real; the benefit in the relevant access pattern is zero.

Closed-ticket paths are also more likely to be referenced externally — by old PR descriptions, branch names, commit messages, blog posts, screenshots. Renaming them retroactively risks invalidating those references in exchange for legibility nobody is using.

## How to apply

When the on-disk ticket layout changes:

- Retrofit open tickets via `git mv` so they ride the new convention going forward.
- Leave `tickets/completed/*` alone. The hook resolver already handles mixed shapes via prefix match ([active-ticket.ts:75](../../packages/cli/templates/hooks/lib/active-ticket.ts:75)).
- If someone resumes a done ticket and wants it renamed, treat that as an explicit per-ticket operation (the `safeword ticket rename` CLI, when [FM5EDA-ticket-slug-rename](../tickets/FM5EDA-ticket-slug-rename/ticket.md) lands).
- Do not write a "retrofit-all-tickets" migration script. The mixed-format property is acceptable forever — the resolver supports both shapes by design.

## Counter-argument acknowledged

Mixed format in `ls completed/` is aesthetically noisy. That's the price. If it ever becomes a real problem, a one-time mass rename is still available — but the bar should be "someone is actually browsing completed/ and getting confused," not "consistency for its own sake."

## Provenance

Decided during PR #160 verify phase, after `/figure-it-out` weighed three options (leave / retrofit all / lazy-rename-on-access). User accepted leave-them.
