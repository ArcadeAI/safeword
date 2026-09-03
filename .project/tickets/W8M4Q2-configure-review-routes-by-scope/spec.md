# Spec: Configure review routes by scope

## Intent

Let users choose local review models once without forcing those preferences into every repository.

## Intake Brief

- **Requested by:** Alex
- **Cost of inaction:** Model preferences must be copied into repositories or left to opaque runtime defaults.
- **Reversibility:** Two-way door; deleting an author entry restores the next scope or built-in behavior.

## Personas

- Technical Builder (TBU)

## Surfaces

Affected: Safeword CLI.

## Jobs To Be Done

### scoped-review-routes.TBU1 — Keep a predictable personal fallback chain

**Persona:** Technical Builder (TBU)

> When I use Safeword across projects, I want to rank reviewers and models in my local profile, so I can get a predictable fallback chain without committing personal preferences.

#### scoped-review-routes.TBU1.R1 — User routes apply when the current project has no route list for that author

#### scoped-review-routes.TBU1.R2 — A project route list replaces the user list for the same author

#### scoped-review-routes.TBU1.R3 — Set and reset preserve unrelated configuration

#### scoped-review-routes.TBU1.R4 — Effective inspection reports the selected source and exact ordered routes

#### scoped-review-routes.TBU1.R5 — Malformed persisted configuration fails visibly without silent fallback

#### scoped-review-routes.TBU1.R6 — Absent scoped routes resolve to the unchanged built-in fallback chain

#### scoped-review-routes.TBU1.R7 — First writes create exactly one config at the selected scope

## Outcomes

- One user-profile file stores personal review preferences.
- Project configuration remains portable and authoritative when explicit.
- Scope precedence never silently merges or reorders lists.

## Open Questions

None.
