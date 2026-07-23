# Behavioral dimensions

| Dimension | Partitions | Scenarios seeded |
| --- | --- | --- |
| Helper path | exact `.safeword/...` relative; `<projectRoot>/.safeword/...` absolute in the installed project; foreign-root, quoted, or `.bak` lookalike | recognized paths; rejected paths |
| Command chain | one skill; contiguous helper-only distinct/repeated chain; short-circuited tail | one proof; ordered distinct/repeated proofs; no tail proof |
| Proof validity | current matching identity; missing; stale; out-of-order helper request | records proof; rejects invalid proof |
| Runtime bridge | Codex; Cursor | each path and chain is exercised through both real hook-to-helper bridges |
