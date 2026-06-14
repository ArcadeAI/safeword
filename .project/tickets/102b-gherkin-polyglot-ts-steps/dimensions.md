# Dimensions: cucumber-js lane as core setup (102b)

Derived from spec.md (AC1/AC2/AC3, done_when) + domain knowledge (safeword's owned-vs-customer file split; package.json merge safety).

| Dimension               | Partitions                                                                                          | AC      |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ------- |
| Project type            | TS (has package.json); pure non-JS (go.mod only, no package.json); polyglot (go.mod + package.json) | AC1/AC2 |
| Lane files written      | cucumber.mjs; steps/ scaffold (world + shared shell-out steps + barrel); features/ starter          | AC1     |
| package.json effects    | deps (@cucumber/cucumber + tsx) merged; test:bdd script added; existing scripts/deps preserved      | AC1     |
| package.json existence  | exists → merge only; missing → minimal private one created (the non-JS delta)                       | AC2     |
| Runnability             | starter feature passes via the scaffolded lane, out of the box                                      | AC3     |
| Re-run / upgrade safety | customer-edited steps + customer .feature files survive a re-run of setup/upgrade                   | AC1     |

**Test layers:** AC1 + AC2 → **integration** (run the built CLI's `setup` on temp fixtures — the existing `tests/commands/setup-*.test.ts` pattern). AC3 → **golden-path integration** (scaffold + install + actually run the lane; slower, one TS + one Go fixture). Re-run safety → integration (setup twice / upgrade after edit).
