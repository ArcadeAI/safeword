# Release candidate verification

Candidate: `2.0.0-rc.1`, based on main `a3c216940fc12a912f97a3f77820e280e1203b65`.
This delivery changes release versions and generated identities, not planning behavior.

## Observed checks

- All five generated surfaces regenerated and checked current. Claude release identity, historical catalogue and inventory checks passed. Parity: 277 pairs and 11 contracts in sync.
- Root typecheck passed. Frozen dependency install passed. Bun retained the old workspace version during both normal install and lockfile-only refresh; only that workspace version was corrected, with no dependency-resolution changes.
- First release run: 82 passed, one failed because `.safeword/version` still said `1.2.0`. Reconciled through `safeword install --agents=none`; repeat release run is pending.
- Created the candidate tarball with `npm pack --ignore-scripts` from the built CLI. SHA256: `1ccef04ad9c83ce00c54cbe2e759a0b71ba1986dd1d5c938e70eb296fc425ab2`. The separate local Bun pack consumed a CPU for over three minutes without output and was stopped; this is not recorded as a successful Bun pack or a successful publish-workflow run.
- A bounded Bun retry using `bun pm pack --ignore-scripts --gzip-level 1 --filename /tmp/safeword-rc-bun-validation.tgz` passed. All 928 archive files have identical bytes to the npm archive. This does not establish which option resolved the earlier delay; no release-workflow change was made.
- Installed published `safeword@1.1.0` into isolated tooling, initialized a disposable project, then installed the candidate tarball and reconciled using `install --agents=none --no-input`. Version advanced to `2.0.0-rc.1`; custom AGENTS instructions and an authored ticket were preserved. Repeating installation returned `healthy`, `changed:false`, and no effects.
- Real Claude CLI installed the candidate from the local marketplace into a disposable profile. Discovery reported 24 skills, two agents and seven hook events. No model session was started for this check.
- Real standalone Codex CLI installed the packed plugin into a disposable profile, reporting version `2.0.0-rc.1`. All 299 packed plugin files matched the installed cache byte for byte. This proves package discovery and copying, not hook execution or Desktop activation.
- Deterministic activation and targeted migration tests are pending, serialized behind another session's existing Vitest process.
- Independent Claude Opus review `03ed4acc-e6e0-4a7a-8688-7d81696fb7af`: approved, cross-agent independence, no blocking findings. This review covered canonical versions, Claude identity and release notes, with the release workflow and generation checker as context. The later lockfile version correction is a matching metadata change, not reviewed behavior.

## Review responses and limits

The reviewer requested passing generated-identity evidence; the checks above supply it. Version synchronization is additionally enforced by `scripts/check-version-sync.ts` and the release test suite, not only the workflow's tag comparison. The main-branch marketplace exposure is accepted only as a disclosed consequence requiring the release PR's explicit merge approval. The opening “opt-in” means npm next and the stable plugin branch, not all repository installation routes. The notes' exclusion of #6031 governs: it is not merged into this candidate and its failing qualification results are not passing candidate evidence.

No fresh paid semantic qualification or real Desktop restart is claimed. No OpenCode or cloud qualification was run. The 33 deferred cases remain deferred and unverified. Historical failed/unfinished acceptance and #4200 recovery evidence remain visible; this candidate does not close the epic. PR #6031 and #5857 remain excluded.

## Publication boundary

Not published. No release PR merge, tag push, Ready promotion or stable promotion has occurred. Before publication: finish the pending local checks, obtain terminal current-head CI, and obtain explicit approval to merge the concrete release PR. Then annotate the merged commit as `v2.0.0-rc.1`, push that tag, watch Release, and confirm npm `next` becomes the candidate while `latest` remains `1.1.0` and the stable plugin branch stays unchanged. A failed check pauses publication; do not weaken it or claim a pass. Recovery means stop using the candidate and retain the prior stable channel; preserve project-authored content and review history rather than promising automatic downgrade of newer state.
