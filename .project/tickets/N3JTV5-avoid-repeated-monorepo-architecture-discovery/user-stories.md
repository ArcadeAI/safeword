# User Stories: Reuse monorepo architecture discovery

## US1 — Heal from one coherent project snapshot

As a Safeword user healing a monorepo architecture document, I want one
operation to discover the project once so the root index and leaf documents
describe the same filesystem snapshot.

Given a monorepo with readable workspace packages, when a project architecture
heal runs, then package discovery supplies both the root index and leaf target
enumeration without a second workspace-manager pass.

Given a monorepo whose only workspace signal is unreadable, when a project
architecture heal runs, then that unreadable manager is observed once and its
coverage gap still appears in the root index.

## US2 — Preserve generated architecture contracts

As a Safeword user with generated architecture documents under version control,
I want the refactor to preserve existing bytes and fingerprints so an upgrade
does not create false architectural drift.

Given an unchanged monorepo, when architecture healing runs before and after
the refactor, then root and leaf output, target order, package order, dependency
edges, fingerprints, and coverage-gap reporting are identical.

## US3 — Avoid repeated purpose extraction

As a Safeword user with a large monorepo, I want each leaf skeleton extracted
once per operation so source-header purpose seeding does not repeat filesystem
reads.

Given a package whose module purpose is seeded from a source header, when a
project architecture heal runs, then the same precomputed skeleton supplies
introspection, fingerprint module names, matching, and rendering.
