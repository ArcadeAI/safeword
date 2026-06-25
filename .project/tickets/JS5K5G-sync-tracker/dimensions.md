# Dimensions: safeword sync-tracker (v1 walking skeleton)

Derived from the ticket's "Done when", "Scope", and resolved open questions. Each
partition becomes ≥1 scenario; boundaries called out inline.

| Dimension                | Equivalence classes / boundaries                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider configuration   | `none` (default) · set + credential resolves · set + **no** credential · unsupported tracker (→ treated as none)                                           |
| Target provider          | `linear` · `github`                                                                                                                                        |
| Ticket → payload mapping | title (no ID prefix) · labels `epic:`/`type:` · state (active→`open`, terminal→`closed`) · body banner + back-link                                         |
| Mapping boundary         | ticket with **no** epic (→ only `type:` label) · ticket already terminal at first sync (→ created `closed`)                                                |
| Sync lifecycle           | first-create · re-run update · partial-failure resume (created, ref-write pending) · sidecar missing/corrupt                                               |
| Field ownership          | owned fields written (existence/title/labels/link) · ceded fields never written (status/assignee/priority) · **close-on-terminal** is the one status write |
| Body egress              | `minimal` (default) · `full` (opt-in) · `full` → **public** GitHub repo (loud egress warning)                                                              |
| Secret resolution        | keychain · env var · never from `.safeword/config.json` · never logged                                                                                     |
| Rate limiting            | normal write · rate-limit error → backoff retry → success                                                                                                  |
| Non-interactive auth     | interactive · CI with `Arcade-User-ID` (user identity, not service account → explicit warning)                                                             |

## Notes

- Every scenario runs against **mocked** Linear / GitHub clients — no live tracker
  (done-when: "no live tracker in tests"). The seam is the injected writer, so the
  test substitutes a fake writer/client and asserts on the calls it received.
- The dependency-graph projection (sub-issues, relations, issue-types, topo-sort)
  is **out of scope** (v2 / M1FGRJ); no dimension here covers it.
