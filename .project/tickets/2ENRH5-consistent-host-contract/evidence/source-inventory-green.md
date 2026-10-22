# Canonical source registration component

Review scope: source discovery/registration, internal repository checker output
and its real-process mutation/repair controls. Review plan: challenge completeness
claims against the accepted feature, verify one registration authority, inspect
read-only discovery and fixture isolation, check real CLI wiring/repair outcomes,
and check whether this introduces dependencies or shipped runtime weight.

The existing parity discovery now exports discoverTemplateSources, joining its
actual template files with SAFEWORD_SCHEMA.ownedFiles/managedFiles destinations.
The existing orphan scan consumes the same function; no second production
registration catalogue exists. check-host-contract reports these actual paths
and destinations, with named error findings for sources lacking registration.

Independent executable RED review f455f2fd-3472-49be-9e88-035786611f8d approved
the strengthened controls before production edits. The actual checker in each
owned repository copy reports all 258 independently frozen baseline sources;
all four unregistered kinds produce a path-specific error; appending an actual
schema registration clears it and retains the source. The initial schema
mutation concern is resolved by executed GREEN, not an assumption: all four
repair subprocesses now pass. Targeted tests: 2 files /35 tests pass, including
existing parity behavior. Targeted lint and CLI types pass. Logs:
/tmp/safeword-source-inventory-green.log and /tmp/safeword-source-inventory-types.log.

This is intentionally not complete contract inventory: source discovery retains
parity's documented underscore-directory exclusion; configured handlers, semantic
facets/owners and lane dispositions remain in the accepted full-graph work.
The checker still sets inventory_complete=false and admission_eligible=false,
reports remaining competing owners, and cannot exit healthy. The frozen path
oracle is test-only and must be deliberately reconciled if shipped sources
change; unrelated untracked template files can correctly expose a local source
population difference. No host runtime or end-user guarantee is certified by
this component. No package dependency or new customer command was added.

Currency: host-provided date 2026-10-22. Primary sources fetched this pass:
https://nodejs.org/docs/latest-v24.x/api/fs.html#fsreaddirsyncpath-options
https://git-scm.com/docs/git-archive
These support filesystem Dirent discovery and the immutable archive boundary;
current code and subprocess results are authoritative for schema semantics.
Current configured principles/personas/surfaces were read via review-knowledge;
structure-enforces and simplicity favor the existing schema seam and direct
real-process observations. This internal maintainer component makes no NTB
usability or native host conformance claim.
