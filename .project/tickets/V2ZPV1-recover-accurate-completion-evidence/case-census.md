# Census provenance and limits

The census is research input, not an installed authority or issued certification.
Compiled from the exact committed feature at b722f9a27a1815abcfb08e6f6ca09dc7317efa46 using the repository's Cucumber/Gherkin compiler.

Case identity is the compiled name and final sourceLines entry (Scenario location for a single case, Examples-row location for an outline). The complete feature SHA-256 additionally binds all original text, headers, Examples and inherited tags. Exclusions are identified per case, never by heading alone.

caseDigest is SHA-256 of UTF-8 JSON.stringify with this exact property order:
`{name: pickle.name, steps: pickle.steps.map(step => ({text: step.text, argument: step.argument})), tags: pickle.tags.map(tag => tag.name)}`.
Undefined argument properties are omitted by JSON.stringify. No pickle IDs or timestamps are included. These are compiled-case identities, not a claim to hash raw source blocks.

The owner mapping comes from the committed feature's @deferred.<ticket> tags and the corresponding accepted deferral tickets. The user confirmed the exact bounded 33-case exclusion policy in this chat on 2026-10-11 at 11:28 AM PDT. A runtime profile must pin these identities and owners; accepting a rewritten local census is forbidden.

The joined inventory has 57 ledger headings, 41 checked R/G/R entries, 136 unchecked R/G/R entries and one unchecked cross-scenario row (137 unchecked total). All 142 active cases map to those headings. Thirty deferred cases map to them; three already-deferred DRD65E/KKP2R3 cases have no original ledger heading and remain separately listed as unverified in ledger-reconciliation.json. Do not invent historical rows for them or omit them from the 33-case report.

The cross-scenario row was open in that original inventory. It is now completed
through the ordinary source-review process with a documented no-change
disposition. Three bounded packets cover the current unique PR5 source; the one
error, a public claim about deferred hosts, was corrected at 6bde6bfd0 and approved
by review 7109ebb6-e22f-4f5b-9c78-e2e649f338e1. ledger-reconciliation.json retains
the original census and separately records the normal prerequisite and new
ledger digest. Recovery has issued no completion credit.

The current dry run binds all 142 active cases to 428 non-hook steps in 28
definition files. Those mappings are research evidence only: skipped dry-run
steps are not passing behavior or independent certification.
