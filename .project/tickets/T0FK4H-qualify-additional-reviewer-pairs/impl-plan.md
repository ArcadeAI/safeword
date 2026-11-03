# Impl Plan: Qualify additional reviewer pairs without retiring the existing pair

**Status:** implemented

Written 2026-11-03, after implementation, when T0FK4H was reclassified from task to feature. It records the approach that shipped on #6319; no plan existed before the code.

## Approach

Pin a list of model pairs beside the shared capability manifest. Derive each pair's revision by substituting its models into the shared settings, so the shipped pair reproduces its existing digest. Catalogue lookup takes every pinned revision and accepts a record only when its models equal its revision's models. The builder and maintainer script emit only pairs with complete, matching evidence and refuse partial, cross-pair or shared-model evidence.

## Decisions

- Evidence stays one file per model, so pinned pairs must not share a model.
- A pinned pair without evidence is listed as unqualified rather than omitted silently.
- `rescore` applies the builder's pair checks (`0eb026c56`), after review 9e6ce3eb found it rescored half-evidenced pairs.

## Design alignment

Keeps the existing admission policy: an unknown pair's Codex route is skipped as `reviewer_capability_unknown` and earns no fallback credit.

## Known deviations

skip: none from the shipped behavior; this plan was written after implementation (see ticket provenance).

## Doc impact

skip: maintainer tooling only; no customer docs describe pinned pairs.

## Assessment triggers

Revisit when the latest pair is qualified, when a pair would share a model, or when review routes change.
