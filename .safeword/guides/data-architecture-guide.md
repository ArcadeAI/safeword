# Data Architecture Decision Guide

Use during Implementation Planning when work changes a data contract, source
of truth, ownership, access, lifecycle, migration, or flow across systems.
One important entity is enough to trigger this guide; entity and file counts
do not decide significance. The feature's `impl-plan.md` remains the design
plan of record. Link detailed models or diagrams only when they clarify a
decision named in that plan.

## Trace one record through its life

For each consequential entity or flow, decide the applicable questions:

1. **Purpose and model:** What does the data represent? Which fields and
   relationships are required to preserve the accepted behavior?
2. **Source of truth:** Which store or service decides the current value?
   Separate an authoritative owner from caches, replicas, derived views, and
   external sources. A named persisted-entity owner must agree with its source
   of truth.
3. **Identity and integrity:** How are records identified, validated, linked,
   deduplicated, and changed concurrently? What is the atomicity boundary?
4. **Access and governance:** Who may read, write, export, or delete it? Which
   privacy, audit, or compliance constraint applies in this project?
5. **Flow and failure:** Where does data originate, transform, cross a trust or
   service boundary, and land? What happens on retry, delay, partial failure,
   and conflicting writes?
6. **Lifecycle:** When is it created, retained, corrected, archived, and
   deleted? Who or what authorizes each transition?
7. **Change and recovery:** What do old and new readers or writers see during
   migration? How is backfill checked? Can the change be rolled back safely,
   or is forward repair required?

Record the chosen behavior, alternatives, reasons, and consequences in the
Implementation Plan. A small model sketch may be enough. For cross-system or
hard-to-reverse ownership, schema, or compatibility choices, use the
architecture guide to decide whether a durable record is needed. A routine
reversible field addition does not require one merely because it is a schema
edit.

The interface contract guide owns caller-visible requests, responses, errors,
and authorization at the entry point; this guide owns the data beneath that
interface. The release and recovery guide owns live cutover policy. The
Execution Plan owns exact migration commands, file edits, backfill batches,
test paths, and evidence collection.

**Example:** A service caches a user's tool access. The plan identifies the
authoritative permission source, cache staleness policy, invalidation trigger,
and behavior when the authority is unavailable. A table definition alone
cannot settle whether access revocation takes effect on the next request.
