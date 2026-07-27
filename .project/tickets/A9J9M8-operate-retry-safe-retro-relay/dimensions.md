# Dimensions: operate retry-safe retro relay (A9J9M8)

Derived from `spec.md` TBU1.R1-R4 and SWM1.R1-R3, the canonical #1479 body,
and the inherited N30CKR relay state machine.

| Dimension | Partitions | Rule |
| --- | --- | --- |
| Harness surface | Claude Code; Claude Code Cloud; OpenAI Codex; OpenAI Codex Cloud; Cursor; Cursor Cloud Agents | TBU1.R1 |
| Persisted bytes | first immutable write; identical retry; changed bytes for same request ID; concurrent different request | TBU1.R1/R2 |
| Claim ownership | active owner; competing owner; expired owner; stale owner returning after takeover | TBU1.R2/R3 |
| Ack crash boundary | before ack rename; after ack rename/before payload cleanup; after cleanup; restart recovery | TBU1.R3 |
| Relay response | durable receipt; timeout; malformed response; accepted response lost | TBU1.R2/R3 |
| Readiness manifest | checked-in disabled; valid fresh injected proof; wrong version/issue; stale timestamp; missing/hash-mismatched artifact | TBU1.R4 |
| Principal | Claude; Codex; Cursor; operator; unknown/rotated | SWM1.R1 |
| Authorization | matching repository; wrong repository; file role; reconcile role; operate role; extra role | SWM1.R1 |
| Token format | classic opaque; stateless dotted `ghs_`; malformed provider response | SWM1.R1 |
| Retry schedule | due before 24h; not due; exact 24h; exponential backoff capped at 1h/deadline | SWM1.R2 |
| Dispatch grace | starts before 24h; attempted at 24h; filed before 25h; filed/maintenance race at 25h | SWM1.R2 |
| Payload lifetime | before 30d; exact 30d; reopened/checkpointed tombstone; encrypted bytes outside application contract | SWM1.R2 |
| Schema startup | fresh v2; valid v1 migration; injected failure at each step; partial v2; newer version; duplicate/missing version row | SWM1.R2 |
| Alert delivery | outbox inserted with transition; crash before log; crash after log/before delivered mark; restart with same event ID | SWM1.R2/R3 |
| Operations caller | operator; harness; unauthenticated | SWM1.R3 |
| Secret observation | child argv/env/output; HTTP response; SQLite/API record; logs; metrics | SWM1.R1/R3 |

## Boundary decisions

- UUIDv4 is generated once before the first atomic persistence and is independent
  of harness identity.
- The network deadline is 750ms and the observable operation ceiling is 1s.
- Retry ends at exactly 24h; no dispatch may begin at that instant.
- A dispatch already begun before 24h gets until exactly 25h, with one CAS
  winner between filing and ambiguity.
- Filed payload becomes application-inaccessible at exactly 30d. This is not a
  forensic disk or backup erasure promise.
- Terminal request identity remains non-reusable indefinitely.
- External alert delivery is at-least-once and deduplicable by stable event ID,
  not exactly once.

## Test layers

- Pure/unit: readiness validation, byte encoding, filename parsing, backoff, role
  matrix, and deadline predicates.
- Filesystem integration: atomic persistence/claims/acks, fault injection, stale
  owner fencing, concurrent different requests, and restart cleanup.
- Runtime integration: real CLI core → real relay HTTP/auth/encryption/SQLite,
  with only GitHub and the deliberately nonresponsive socket at network seams.
- Store integration: version-1 migration, injected rollback, deadline CAS,
  tombstone reopen/checkpoint, retained evidence, and outbox recovery.
- Inherited regression command:
  `bun run test:bdd -- --tags '@retry-safe-retro-filing'` plus the relay
  integration suite; raw REST marker authority, sanitized-MCP non-authority,
  and ambiguous-create recovery are never mocked away.
