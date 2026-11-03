# Dimensions: Qualify additional reviewer pairs without retiring the existing pair

Written 2026-11-03, after implementation, when T0FK4H was reclassified from task to feature.

| Dimension | Partitions and boundaries |
| --- | --- |
| Pinned pair | shipped qualified pair (`claude-opus-5`/`gpt-6-astra`) · latest pinned pair without evidence (`claude-opus-5-5`/`gpt-6.1-sol`) · an unpinned pair |
| Evidence per pair | none · one model only · both models · models from another pair · a model shared by two pinned pairs |
| Record binding | record models match its revision · record claims another pair's revision |
| Maintainer command | `verify` · `generate` · `record --pair` · `rescore` |
| Admission path | catalogue lookup · planning review through the coordinator |
