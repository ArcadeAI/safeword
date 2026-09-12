# Dimensions: Point-of-need Safeword enrollment

| Dimension | Partitions and boundaries | Scenario consequence |
| --- | --- | --- |
| Enrollment state | marker absent; marker present with complete managed setup; marker present with required managed setup missing; non-marker Safeword paths already present | Only the marker establishes enrollment; incomplete enrolled state gets setup recovery rather than another enrollment choice; other pre-existing paths remain untouched before consent. |
| State dependency | required; optional with declared stateless path; no project-state dependency | Required work stops after decline, optional work may continue truthfully, and stateless work never prompts. |
| Access route | CLI command; packaged helper; generated agent workflow; agent-authored artifact | Every route reaches the same enrollment boundary before consuming or creating project state. |
| Consent outcome | accept; decline; no response or cancellation | Only acceptance authorizes installation; every other outcome leaves the initiating state access stopped. |
| Consent actor | builder; agent acting without builder acceptance | Only the builder can authorize enrollment; an agent cannot accept its own mediated prompt. |
| Installation outcome | required setup succeeds; partial result still satisfies the initiating requirement; initiating requirement remains unmet | Resume depends on proven prerequisites rather than the install command's aggregate label. |
| Resume cardinality | zero; exactly one; accidental duplicate | Successful setup resumes once; decline, cancellation, and unmet setup never resume or loop. |
| Prompt cadence | first state need; later state needs in the same operation; a later independent operation | One initiating operation prompts at most once; an unenrolled later operation may ask again because no dismissal state is persisted. |
| Prompt language | user-facing benefit and bounded effects; internal marker, invocation-log, or proof jargon | The prompt explains what setup enables and what will change without exposing implementation vocabulary. |
| Explicit lifecycle intent | install or accepted install plan; inspection/removal command; ordinary workflow | Enrollment operations do not prompt recursively; read-only lifecycle commands keep their truthful no-enrollment result; ordinary stateful workflows ask. |
| Install scope | shared project substrate; current host-required assets; unrelated hosts or development dependencies | Consent covers the reviewed bounded plan, never unrelated installation effects. |
| Namespace | default; configured custom; supported legacy | The same enrollment decision and post-enrollment state resolution hold for every supported namespace. |
| Host surface and derived proof boundary | Claude Code, OpenAI Codex, OpenCode, and Cursor through installed-artifact invocation; direct Safeword CLI through a real command process | Generated and native delivery differences do not change the user-facing contract; the proof boundary is derived from the host and is not an independently varied dimension. |
| Host delivery | project-installed integration; profile-delivered OpenCode plugin | The bounded plan installs only repository-owned substrate and host assets that belong in the repository; it never copies profile-delivered OpenCode runtime into project state. |
| Proof observer | filesystem observation independent of Safeword; Safeword-owned instrumentation | Acceptance proof uses the independent observer so bypassing Safeword's own boundary cannot hide a path access. |
| Representative workflow | automatically routed BDD; no-ticket quality-review proof; another catalogued state consumer | BDD proves required-state behavior, quality-review proves optional stateless continuation, and the inventory prevents special-case coverage. |
| Failure timing | before install; during approved install; after required setup but before resume | No pre-consent mutation occurs; approved partial effects are reported; resume remains prerequisite-checked and exactly once. |
| Concurrent drift | repository remains unenrolled while awaiting choice; another actor enrolls with sufficient setup; another actor enrolls without sufficient setup | The operation rechecks current enrollment and required setup, never duplicates installation, and resumes only when the initiating prerequisite is proven. |

## Pruned combinations

- Exact malformed CLI payloads and parser failures belong in lower-level table-driven tests; acceptance scenarios cover the externally meaningful action-required result.
- Every workflow × every host is covered by a catalogue/parity proof plus representative end-to-end cases rather than a Cartesian scenario matrix.
- Installed-artifact surface proofs may replace only the external host process; Safeword's installed artifact and filesystem observation stay real. The real-host Killer Demo uses a pinned scripted driver and waits on observed events rather than elapsed time.
- Customer files outside declared Safeword ownership are out of scope and need one preservation boundary, not per-file scenarios.
- skip: Repositories presenting multiple namespace conventions retain the existing resolver's precedence; enrollment recovery does not redesign namespace-conflict behavior.
