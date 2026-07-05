# Behavioral Dimensions: managed-file provenance refresh

The refresh decision varies along these independent dimensions. Scenarios pick
representative partitions and the load-bearing boundaries.

| Dimension            | Partitions (equivalence classes)                                                          | Boundary / edge                                                      | Covered by scenario                          |
| -------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| Provenance state     | recorded+matching (**pristine**) · recorded+differing (**edited**) · **unrecorded**        | unrecorded is the pre-manifest install case — the adoption boundary  | refresh; edited-untouched; adoption pair     |
| Staleness            | on-disk == current resolved output (**current**) · differs (**stale**)                     | pristine+current must be a no-op (churn boundary)                     | no-churn; refresh                            |
| Content source       | static template · **ctx-generator content** · generator returns **undefined** (suppressed) | generator-undefined mid-life (langpack no longer applies)             | generator-refresh; generator-suppressed      |
| File existence       | present · **missing** (user deleted)                                                       | missing must keep today's create-if-missing parity + gain provenance  | recreate-missing                             |
| Command surface      | setup · **upgrade** · diff (dry-run) · reset/uninstall                                     | diff must report would-refresh without writing                        | setup-records; diff-preview; cleanup         |
| Manifest integrity   | present+valid · **absent** (pre-manifest) · **corrupt/unparseable**                        | corrupt must fail safe (no refresh, no crash) — never guessed pristine | adoption pair; corrupt-manifest              |
| configKey suppression | not overridden · **overridden** (`paths.<key>` set)                                        | overridden entries stay fully suppressed (K7N2QM parity)              | configkey-suppressed                         |

**Partitioning notes**

- The load-bearing boundary is **provenance × staleness**: only pristine+stale writes. The other three cells (pristine+current, edited+anything, unrecorded+anything except byte-identical) must all be no-writes — each gets a pinning scenario.
- **Adoption** is deliberately asymmetric: unrecorded+byte-identical → gain provenance without a write; unrecorded+differing → permanently unmanaged. The differing case is scenario'd across TWO upgrades to prove "permanently" (no delayed adoption).
- **Corrupt manifest** partitions with absent, not valid — fail-safe means both behave as "cannot prove pristine" (SM1.R2), and neither crashes the upgrade.
- Not separately scenario'd (covered by unit assertions under GREEN): sha256 vs other hash choice, manifest JSON shape/versioning, per-pack enumeration of every managed file (one static + one generated representative proves the mechanism; the pass iterates the same schema record for all).
- SM1.R3 (comment correction) is documentation, not runtime behavior — carries `skip:` in test-definitions, verified at review.
