# Dimensions: Let projects track feature surfaces during BDD

| Dimension | Partitions | Acceptance criteria |
| --- | --- | --- |
| Namespace root state | fresh `.project`, legacy-only `.safeword-project`, configured `paths.projectRoot` | TB1.AC1, SM1.AC1 |
| Surface file ownership | missing scaffold, pre-existing authored file, configured path override, reset-full cleanup | TB1.AC1, TB1.AC2, SM1.AC1 |
| BDD guidance state | populated surfaces, missing/empty surfaces, reusable runtime/context surface not in project inventory | TB1.AC3 |
| Spec authoring surface | canonical template, installed dogfood template, Affected/Unaffected examples | NTB1.AC1 |
| Feature-source surface tags | affected surface covered, affected surface explicitly skipped, affected surface missing, stale `@surface.*` tag | SM1.AC2 |
| Customer fixture posture | temp project outside dogfood repo, no `.project` assumptions beyond resolver, no SafeWord dogfood-only layout assumptions | TB1.AC1, SM1.AC1, SM1.AC2 |

Boundary values:

- `paths.projectRoot: "."` keeps namespace-root behavior from writing a managed root `.gitignore`; surfaces must still resolve to `<cwd>/surfaces.md`.
- `paths.surfaces: ""` behaves as unset, matching existing configured-path semantics.
- Missing `surfaces.md` is advisory for BDD intake, never a hard gate.
- Missing `@surface.<slug>` coverage is a `safeword check` advisory, not a hard failure.
