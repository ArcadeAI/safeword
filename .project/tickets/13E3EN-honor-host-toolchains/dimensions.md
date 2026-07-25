# Behavioral Dimensions: Honor host JavaScript toolchains during agent edits

| Dimension | Partitions and boundaries | Scenarios seeded |
| --- | --- | --- |
| Host owner | Ultracite legacy v6 preset; Ultracite current Biome preset; direct Biome; unsupported alternative formatter | Host command selection; safe fallback |
| Workspace ownership | Root config; nested config extending a root; sibling workspace; Safeword-owned path | Nearest-owner resolution; generated-path exclusion |
| Executable availability | Owning-workspace local binary; root-hoisted local binary; missing binary | Local-only execution; missing-binary warning |
| Host result | Fixable edit; remaining check violation; file excluded by host config | Fix then check; diagnostic reporting; host policy ownership |
| Ambient state | Clean environment; hostile `BIOME_CONFIG_PATH`; hostile `BIOME_BINARY` | Environment isolation |
| File path | Normal source path; dash-prefixed filename; symlink escape outside project root | Argument safety; canonical-root containment |
