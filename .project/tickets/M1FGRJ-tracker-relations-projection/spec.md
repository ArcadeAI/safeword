# Spec: sync-tracker v2 — project the dependency graph

## Intent

Extend `safeword sync-tracker` from a flat issue mirror to a dependency-aware
coordination mirror. Local ticket files remain canonical, while supported
trackers receive native hierarchy, type, and dependency links when their APIs can
represent them.

## References

- GitHub issue: <https://github.com/ArcadeAI/safeword/issues/347>
- Parent implementation: `../JS5K5G-sync-tracker/ticket.md`
- Local relation source: `depends_on:` from `../AKZJXC-ticket-relations/ticket.md`

## Personas

- Technical Builder (TB)

## Vocabulary

- **Native hierarchy:** a tracker parent/sub-issue relationship, not a label.
- **Native relation:** a tracker blocking/blocked-by edge, not prose in the body.
- **Fallback label:** the existing v1 `epic:<slug>` or `type:<type>` label when
  the tracker cannot set a native field.

## Jobs To Be Done

### tracker-relations.TB1 — Mirror ordering and dependencies without moving source of truth

**Persona:** Technical Builder (TB)

> When my local ticket corpus has parents, epics, types, and dependencies, I want
> `safeword sync-tracker` to project those fields into my external tracker, so I
> can coordinate roadmap order and blockers with teammates without editing the
> tracker by hand.

#### tracker-relations.TB1.AC1 — Parents exist before children are linked

Tickets with a resolvable `parent:` or `epic:` link are projected after their
parent so providers that link existing issues can succeed without a second pass.

#### tracker-relations.TB1.AC2 — Native hierarchy is attempted only for known parents

If `parent:` or `epic:` resolves to a known ticket in the current corpus, the
writer receives the parent tracker ref. If it does not resolve, the v1 labels
remain and native hierarchy is skipped.

#### tracker-relations.TB1.AC3 — Dependencies become native issue relations

Each `depends_on:` or `blocked_on:` edge whose target resolves to a synced ticket
is projected as a native blocked-by/dependency relation. Dangling or cross-branch
refs are skipped without creating a blind issue.

#### tracker-relations.TB1.AC4 — Type promotion keeps the label fallback

Writers receive the ticket's type as the native issue type candidate while the v1
`type:<type>` label remains in the payload for providers or repositories without
native issue-type support.

#### tracker-relations.TB1.AC5 — Graph projection is idempotent

The writer receives a graph request after create, update, or pending-entry
reconcile. Re-running the command replays the same graph links against the same
sidecar refs rather than creating duplicate issues.

## Outcomes

- `sync-tracker` produces parent-before-child create/update order.
- `IssuePayload` carries native type and graph intent without removing v1 labels.
- Writers expose graph projection through mocked unit-testable methods.
- The live GitHub adapter uses current `gh issue edit` graph flags where
  available and treats unsupported issue types as a label fallback.

## Open Questions

- defer: GitHub Projects v2 Status-field ownership needs a separate decision
  because v1 deliberately ceded status except for close-on-terminal.
