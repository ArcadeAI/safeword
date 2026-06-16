# Behavioral Dimensions: test-plan resolver

The resolver's output varies along these independent dimensions. Scenarios in
`features/test-plan-resolver.feature` pick representative values (equivalence
classes) and boundaries from each.

| Dimension              | Partitions (equivalence classes)                                            | Boundary / edge                         | Covered by scenario                |
| ---------------------- | --------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------- |
| Languages present      | none · one · **polyglot (≥2)**                                              | the ≥2 case is the false-green boundary | JS+Python; Go+Rust                 |
| JS test signal         | real `test`/`test:done` script · **stub `package.json` (no script)**        | empty `scripts: {}` (102b stub)         | pnpm test script; JS-stub-no-entry |
| JS package manager     | bun · pnpm · yarn · npm                                                     | lockfile picks PM                       | pnpm run test                      |
| Python runner          | `tox.ini` → tox · pytest config/installed → pytest · **neither → unittest** | unittest fallback is the floor          | tox; unittest; uv pytest           |
| Python package manager | uv · poetry · bare                                                          | lockfile picks PM                       | uv run pytest                      |
| Rust runner            | nextest installed → nextest · **cargo-only → cargo test --workspace**       | absence of nextest                      | rust nextest; rust cargo default   |
| Go layout              | single module (`go test ./...`) · **`go.work` workspace**                   | workspace needs `go list -m` expansion  | go workspace                       |
| Toolchain availability | installed (`available:true`) · **absent (`available:false`, still listed)** | absent must not drop the entry          | go-not-installed                   |
| Manifest location      | root · **nested sub-dir** · vendored/excluded dir                           | `node_modules`/`vendor` excluded        | nested python; vendored ignored    |
| Plan kind              | test · **build**                                                            | Python has no build entry               | build plan                         |
| Surface                | in-process resolver · **CLI `safeword test-plan --json`**                   | JSON contract for consumers             | CLI prints JSON                    |

**Partitioning notes**

- The load-bearing boundary is **polyglot (≥2 languages)** — it is the case that produces the false-green bug, so two scenarios exercise it (JS+Python, Go+Rust) across different language pairs.
- Toolchain-absent is a boundary, not a happy path: the entry must still appear (`available:false`) so a consumer skips loudly.
- JS detection keys on a **real test script**, not the `package.json` file (every repo has one since ticket 102b) — the stub-no-entry scenario pins that boundary.
- Not separately scenario'd (lower-risk combinations, covered by unit assertions under GREEN): poetry vs bare-pytest PM variants, bun/yarn/npm PM variants, Rust nextest config-file vs binary detection. The dimension is proven once; PM permutations are table-driven unit cases.
