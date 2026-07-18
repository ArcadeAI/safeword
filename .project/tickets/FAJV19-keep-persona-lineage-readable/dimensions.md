# Dimensions: Keep persona lineage readable for builders

| Dimension | Partitions and boundaries | Scenario coverage |
| --- | --- | --- |
| Name shape | one word; two words; three–four words; more than four words; apostrophe; hyphen | Canonical derivation outline |
| Canonical length | 3 characters; 4 characters; too-short source | Canonical derivation outline; too-short rejection |
| Collision | ordered first code; second colliding code; suffixes 2–9; exhausted suffix space | Collision and exhaustion scenarios |
| Explicit compatibility | legacy lengths 2, 5, 6; canonical lengths 3, 4; invalid lengths 1, 7 | Legacy acceptance; invalid rejection |
| Runtime parity | CLI resolver; installed hook; Claude/Codex/Cursor authoring assets | Derivation parity outline; installed-asset outline |
| Historical safety | existing explicit codes; completed lineage; customer-owned personas.md | Legacy acceptance; historical rewrite excluded |

The riskiest boundary is compatibility: changing derivation must not make an
existing explicit code or previously-authored persona reference unreadable.
