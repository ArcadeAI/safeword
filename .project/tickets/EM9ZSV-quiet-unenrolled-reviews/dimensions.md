# Dimensions: Point-of-need Safeword project context

| Dimension | Partitions and boundaries | Scenario consequence |
| --- | --- | --- |
| Project context | enrolled marker in current repository; marker above current repository; no enclosing marker; incomplete enrolled state; non-marker Safeword paths | Current-repository state is reused; a containing project is offered as a choice; absence reaches local-consent/global-fallback flow; only a marker establishes enrollment. |
| State dependency | required; optional; none | Required and optional state use the selected project context; stateless work never resolves or creates project state. |
| Access route | CLI command; packaged helper; generated workflow; agent-authored Safeword artifact | Every route reaches the same boundary before consuming or creating project state. |
| Local consent outcome | accept; decline; no response/noninteractive; interrupted prompt; cancelled install plan | Only explicit builder acceptance plus plan approval authorizes repository mutation; every other outcome selects global state automatically. |
| Consent actor | builder input; agent-generated answer without builder input | Agent output cannot authorize repository mutation and therefore falls back globally. |
| Selected storage | current local overlay over global; checkout-specific global partition; enrolled containing project; new global partition | Local data shadows global when present; an existing exact-checkout global partition wins over an unrelated containing project; otherwise one resolved context serves the operation. |
| Global identity | same checkout; unrelated checkout; linked worktree; non-Git directory | The same project identity reuses knowledge, unrelated identities are isolated, worktree-local mutable state cannot collide, and canonical paths identify non-Git projects. |
| Global privacy | owner-private location; repository-visible location | Global fallback writes only to the user-private Safeword store and never to the repository. |
| Global availability | readable and writable; missing but creatable; unavailable or unwritable | Existing state is reused, absent state is created automatically, and unavailable global storage stops plainly without mutating the repository. |
| Prompt cadence | first state need; later need in same operation; later operation with global partition | At most one local-setup choice appears; global fallback needs no second prompt and later work reuses the partition without asking again. |
| Prompt language | user-facing benefit and bounded effects; internal marker, invocation-log, or proof jargon | The choice explains local setup and automatic private fallback without internal vocabulary. |
| Explicit lifecycle intent | install; status/doctor/plan/uninstall; ordinary stateful workflow | Install enters its canonical plan directly; inspections remain read-only; ordinary workflows resolve context at point of need. |
| Install scope | shared project substrate; current host assets; global hydration input; unrelated integrations/dependencies | The reviewed plan contains only disclosed local effects plus compatible global data selected for hydration. |
| Installation result | complete; partial but sufficient; insufficient; cancelled; failed | Sufficient local setup may become authoritative; every other result preserves or creates global authority and resumes once without reclassifying the installer result. |
| Hydration source | no global partition; global-only data; same path on both sides with compatible content; conflict; unreadable or corrupt source | No source adds no hydration step; compatible data copies locally; conflicts are surfaced; unreadable data blocks overlay activation without changing global state. |
| Hydration completion | verified success; cancelled; failed before verification | The local overlay activates only after verification; every outcome preserves the global partition. |
| Overlay availability | present on current branch; absent after branch switch; locally deleted or uncommitted elsewhere | Present local data shadows global; absence falls back to the preserved global snapshot without a prompt. |
| Namespace | default; configured custom; supported legacy | Local install targets the selected namespace and hydration resolves data into that namespace without creating a second default root. |
| Host surface and proof boundary | Claude Code, OpenAI Codex, OpenCode, Cursor via installed artifacts; Safeword CLI via real process | Delivery differences do not change context resolution, consent, fallback, or overlay behavior. |
| Proof observer | filesystem observation independent of Safeword; Safeword-owned instrumentation | Repository non-mutation and boundary timing use an independent observer so a bypass cannot hide access. |
| Representative workflow | automatically routed BDD; no-ticket quality review; another catalogued state consumer | BDD proves global artifact continuity, quality review proves global invocation proof, and catalogue parity prevents special cases. |
| Concurrent drift | still unenrolled; concurrently enrolled sufficiently; concurrently enrolled insufficiently | Resolution rechecks current facts, avoids duplicate installation, and chooses one valid authority. |

## Pruned combinations

- Exact malformed CLI payloads, path hashing, and corrupt-field matrices belong in lower-level table-driven tests; acceptance scenarios cover visible recovery classes.
- Every workflow × host × storage mode is covered by catalogue/parity proof plus representative end-to-end cases rather than a Cartesian matrix.
- Linked worktrees share project knowledge only where the resolved project identity matches; session and mutable execution state stay worktree-scoped. The exact identity algorithm is an implementation decision, while reuse and isolation are behavioral requirements.
- Installed-artifact surface proofs may replace only the external host process; Safeword's installed artifact and independent filesystem observation stay real.
- Customer files outside declared Safeword ownership are out of scope and need one preservation boundary, not per-file scenarios.
- skip: Repository moves may require an explicit future relink command; transparent identity across arbitrary moves is not required by this ticket.
