# Dimensions: Keep cachebusted Codex plugins operational

| Dimension | Partitions and boundaries | Rules |
| --- | --- | --- |
| Effective version input | absent · exact base version · same release with build metadata · invalid SemVer · different release | TBU1.R1, SWM1.R1 |
| Version-bearing artifact | plugin manifest · runtime package · generated workflow command · bundled CLI identity · profile proof | TBU1.R1, TBU1.R2 |
| Installed execution | exact immutable cache directory exists · generated command launches runtime · status compares the same identity | TBU1.R2 |
| Host isolation | Codex catalogue changes · Claude Code catalogue unchanged · Cursor catalogue unchanged | SWM1.R2 |
| Upstream contract | task-bound plugin root is specified · local delivery does not require host adoption | SWM1.R3 |

## Boundary decisions

- An effective version may equal the package version or add SemVer build
  metadata to that same release identity. It may not change the core or
  prerelease portion of the release.
- Rejection must occur before the shipped output tree is reconciled, so a bad
  override cannot leave a partially rewritten bundle.
- The end-to-end proof installs the generated fixture through the real Codex
  plugin command and executes the installed runtime; mocks stop at the Codex
  process boundary.
- Claude Code and Cursor keep their existing version and path mechanisms. The
  Codex generator must not become a shared mutable version source.
- The upstream plugin-root proposal is a durable design output, not a runtime
  dependency or a promise that Codex will adopt it.
- Recovery from a failed `codex plugin add`, an unwritable cache, or a partially
  extracted host bundle is a Codex installation concern; this feature proves
  coherent Safeword output and successful installation, not host recovery.
