# Investigation ledger

Date: 2026-10-23, America/Los_Angeles, host-provided date.
This is subordinate research evidence; impl-plan.md owns design decisions.

## Frame and candidates, before surveying implementation

Decide how a local fixed-lane observer can authenticate complete execution without permitting project-edited proof, dirty-input success, historical rewrite or completion authority.

1. Run in the source checkout and save a signed runner JSON. Smallest process count; generated outputs can contaminate bound inputs and source changes can race execution.
2. Run a committed archive in a disposable directory, with a runtime-shipped exact assertion inventory and external append-only attempt storage. More preparation, but source and output boundaries are distinct.
3. Adapt the stale observer/certifier branch as a general recovery framework. Existing machinery may save effort, but its larger contract and obsolete profile require recertification and exceed observer-only authority.

## Research domains and questions

- Runner identity/completeness: what does installed Vitest 5.0.3 JSON actually identify, including expanded parameter rows, retries and failures? Can every existing delivery case be mapped without manufacturing assertions?
- Committed execution/isolation: what does a Git archive include or omit; how do pre/post original-checkout identities and frozen dependencies constrain honest execution?
- Persistence/authentication: which existing durable-write and crypto primitives support exclusive records, terminal publication, process death and purpose-separated verification without changing review gates?
- Freshness/authority: which product and execution inputs must be byte-bound, which ticket fields are semantic, and how can audit-only changes preserve currency without becoming a blanket exemption?
- Operator recovery/interface: how does the current CLI protocol carry typed outcomes and concrete recovery; which consumers could mistake execution success for approval?

Research must use primary sources and installed declarations, disclose no private context externally, execute no retrieved code, add no dependencies and launch no paid qualification. Existing C7 characterization is source evidence, never an observer result.
