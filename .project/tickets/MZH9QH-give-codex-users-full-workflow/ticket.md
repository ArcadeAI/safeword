---
id: MZH9QH
slug: give-codex-users-full-workflow
type: feature
subtype: bug-investigated
phase: done
status: done
phase_anchors:
  - 'define-behavior: .project/tickets/MZH9QH-give-codex-users-full-workflow/spec.md'
  - 'scenario-gate: packages/cli/features/give-codex-users-full-workflow.feature'
  - 'plan-implementation: packages/cli/features/give-codex-users-full-workflow.feature'
  - 'implement: .project/tickets/MZH9QH-give-codex-users-full-workflow/impl-plan.md'
  - 'verify: .project/tickets/MZH9QH-give-codex-users-full-workflow/test-definitions.md'
  - 'done: .project/tickets/MZH9QH-give-codex-users-full-workflow/verify.md'
scope:
  - Generate the Codex plugin skill catalogue from every workflow under `packages/cli/templates/skills/`, including supporting phase documents as plugin references.
  - Define and test the small, explicit transformation allowlist required for Codex-compatible skill metadata, scoped skill invocation, and packaged reference paths.
  - Replace Codex parity checks that expect retired repository-local workflow assets with package, cache, and installed-plugin proofs.
  - Make Codex migration a safe two-step handoff: install and enable the profile plugin without removing legacy hooks, then retire only Safe Word-owned hooks through an explicit post-trust cleanup action.
  - Make missing or stale plugin-hook trust visible and blocking: Codex must skip the affected hook and direct the user to review it, while Safe Word preserves legacy hooks and never bypasses or edits Codex trust state.
  - Extend release, integration, live-smoke, and documentation coverage for the generated profile plugin while retaining Bunx-only hook commands.
  - Apply audit-directed patch updates to development-only Codex, Cucumber, and Knip tooling and remove stale Knip binary suppressions as part of final verification.
out_of_scope:
  - Rewriting Safe Word workflow policy or changing the canonical template content except for unavoidable Codex path and invocation adaptation.
  - Changing Claude Code or Cursor workflow delivery, schema ownership, or behavior.
  - Automatically installing a Codex profile plugin during `safeword setup` or `safeword upgrade`.
  - Bypassing or mutating Codex's undocumented plugin-hook trust state.
  - Supporting Codex Cloud, an npx path, or a Node-only fallback for the Bun-required Codex integration.
done_when:
  - The packed Codex plugin contains every canonical Safe Word skill and each supporting reference asset required by that skill's workflow, with no unexpected content difference outside the allowlist.
  - Source, packed-package, and isolated installed-plugin tests detect missing skills, missing BDD phase references, and stale platform paths; generated skill metadata stays within Codex's documented 8,000-character fallback discovery budget, while explicit scoped invocation remains available when Codex shortens or omits an initial listing.
  - Fresh setup, initial migration, and an isolated installed-plugin session leave no Safe Word-owned workflow tree under the target project's `.agents`, `.codex`, or `.safeword` directories.
  - Initial migration preserves legacy Safe Word hooks and gives the builder the trust handoff; an explicit completion action removes only Safe Word-owned legacy hooks while preserving user-authored configuration.
  - A fresh or changed Safe Word plugin hook that has not been trusted is skipped with Codex's review-required warning, and Safe Word leaves legacy hooks in place until the user completes the handoff.
  - Codex persona-lineage coverage reads the packaged plugin model rather than retired repository-local BDD files, and Claude Code and Cursor regression checks remain unchanged.
  - The published documentation explains complete scoped skill availability, the two-step migration, and Bunx-only hooks.
created: 2026-07-15T18:26:26.899Z
last_modified: 2026-07-17T15:58:30Z
---

# Give Codex users the full Safe Word workflow

**Goal:** Provide Codex users the complete Safe Word workflow from the profile plugin without installing workflow files into their repositories.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-15T18:26:26.899Z Started: Created ticket MZH9QH
- 2026-07-16T15:08:00.000Z RED: `bun run --cwd packages/cli test:bdd -- --tags '@codex-workflow.TBU1.R1'` reported two undefined scenarios and nine undefined steps for the first plugin-catalogue acceptance contract.
- 2026-07-16T15:15:00.000Z RED: `bun run --cwd packages/cli test tests/commands/migrate-codex-plugin.test.ts` proved initial migration deletes legacy hooks and rejects the explicit `--remove-legacy-hooks` handoff command.
- 2026-07-16T15:40:03.000Z GREEN: `6e5492f3` removed the empty project-local Codex scaffold, centralized Bunx hook policy, and aligned migration and published documentation with the explicit trust handoff.
- 2026-07-16T15:41:42.000Z GREEN: `47f89f44` bound every deterministic scenario to real generator, package, cache, setup, and hook-policy contracts; `bun run --cwd packages/cli test:bdd` passed 83 scenarios and 986 steps.
- 2026-07-16T15:44:26.000Z Phase transition: all executable scenarios are green; manual Codex trust evidence is recorded in `packages/cli/tests/smoke/codex-plugin-manual-acceptance.md`. Moving to verification.
- 2026-07-16T15:45:00.000Z Process correction: normalized the R/G/R ledger to the ticket validator's one-distinct-SHA-per-RED/GREEN contract; explanatory provenance remains in the ticket work log.
- 2026-07-16T16:22:18.000Z Verification fix: full-suite Rust setup exposed an unrelated detector self-contamination bug. The targeted detector and full Rust golden-path suites pass after the narrow correction; see Root Cause below.
- 2026-07-16T17:01:00.000Z Verification fix: the generated Codex catalogue scoped commands in primary skill documents but copied reference assets verbatim. The generator now adapts all Markdown workflow invocations; the migration contract distinguishes command-shaped invocations from slash-delimited prose.
- 2026-07-16T22:00:00.000Z Audit maintenance: updated development-only Codex, Cucumber, and Knip tooling; `bunx knip` is clean after removing stale binary suppressions.
- 2026-07-16T22:08:20.000Z Independent quality review found that explicit cleanup could delete a user hook whose command merely began with `safeword`.
- 2026-07-16T22:34:55Z GREEN: `09c3e8eed` restricts cleanup to exact package invocations and known historical scripts, adds mixed-block preservation regressions, pins the live smoke to `codex-cli 0.144.5`, and records current interactive trust evidence.
- 2026-07-16T23:31:03Z Independent quality review found two remaining boundary defects: cleanup still recognized arbitrary pinned Bunx and bare `safeword` commands, and the catalogue could rewrite `/verify/README.md` or `/verify/_draft.md` as skill invocations.
- 2026-07-16T23:35:05Z Re-review approved the fix: cleanup now recognizes only the exact historical `npx --yes safeword` project-hook form; the catalogue treats every slash suffix as a path boundary. Focused migration, release, lint, and typecheck checks passed.
- 2026-07-16T23:56:41Z Final verification: 5,202/5,202 tests passed (5 skipped), the BDD lane passed 484 scenarios (3 skipped), lint/typecheck passed, and audit passed with expected generated/parity clone warnings plus pre-existing persona aliases.
- 2026-07-17T15:58:30Z Complete: Retested after the latest main catch-up and corrected the stale BDD assertion to inspect the actual packaged planning reference. The current full suite, BDD lane, lint, typecheck, audit, live-smoke evidence, and independent review all support closure; user approved the done transition.

## Root Cause

Fresh Rust setup initially finds no project shell source, so it correctly omits
`prettier-plugin-sh` from the first dependency install. Before the setup
self-health check, language-skill installation creates
`.agents/skills/rust-skills/checks/check.sh` and a matching `.claude` copy.
The second project scan incorrectly treats those generated agent files as user
shell source, reports the plugin as missing, and makes an otherwise successful
setup exit 1.

Confirmed by a retained fresh Rust fixture: dependency installation completed,
then health reported only `prettier-plugin-sh` missing. The regression test
fails before agent configuration roots are excluded and passes after; the full
Rust golden-path file then passes 48 tests.

Ruled out:

- The Codex plugin-only schema change: it changes only the `.codex` shared
  scaffold and does not participate in package detection.
- Safe Word's own `.safeword` hook scripts: the shell detector already excluded
  that directory.
- A package-manager failure: setup reported successful dependency installation;
  the false missing-package result came from the later health scan.

### Codex reference-asset command transformation

The original catalogue generator adapted scoped invocations only in a skill's
`SKILL.md`. Supporting reference assets were copied verbatim, so Codex could
read an instruction such as `Run /verify` even though Codex plugins expose the
skill as `$safeword:verify`. The migration-residue test found the problem, then
its broad slash matcher also falsely classified `test/build/typecheck/bdd` as a
bare command.

Confirmed by a RED release-contract fixture whose reference asset says
`Run /beta`: it produced `/beta` before the change and `$safeword:beta` after.
The focused migration scenario now passes with a command-shaped invocation
matcher.

Ruled out:

- A stale checked-in catalogue: regenerating after the generator change
  produced the scoped reference assets.
- A Codex plugin alias: the installed skill names remain scoped; this was
  documentation guidance, not runtime skill discovery.

### Codex legacy hook ownership

The cleanup detector identified ownership with `startsWith('safeword')`, so a
user command such as `safeword-tools hook codex pre-tool-use` or
`npx --yes safeword@evil hook codex pre-tool-use` could be deleted during the
explicit post-trust handoff. It also treated any script under
`.safeword/hooks/codex/` as Safe Word-owned.

Confirmed by a CLI-level RED regression that mixed a genuine historical Safe
Word hook with those user commands; the old cleanup removed the whole handler
section. The replacement matches only exact historic package forms, known
Codex hook events, and the finite set of scripts Safe Word shipped. A second
regression preserves a user script adjacent to an exact historical hook.

Ruled out:

- Initial migration: it never removes project hooks, so this is confined to
  the explicit `--remove-legacy-hooks` action.
- Codex trust state: cleanup still runs only after Codex reports the profile
  plugin enabled and never reads or writes Codex's trust hashes.

### Codex legacy-command re-review

The first ownership hardening still classified any semver-pinned
`bunx --bun safeword@X.Y.Z` command and any bare `safeword` command as
Safe Word-owned. Neither form is a finite historical project-hook identity:
the former is the profile-plugin delivery shape and the latter can be a
user-authored command.

Confirmed by a CLI-level fixture that preserves both forms while removing the
genuine historical `npx --yes safeword hook codex pre-tool-use` command. The
reviewer independently approved the narrowed detector.

Ruled out:

- The current profile plugin: its Bunx commands are not project-local legacy
  hooks and must never be removed by migration cleanup.
- Bare CLI use: Safe Word never generated a bare `safeword` project hook, so
  preserving it cannot leave a shipped legacy artifact behind.

### Codex scoped-command path boundary

The catalogue's command adaptation originally treated only lowercase and
numeric slash suffixes as paths. A valid reference such as
`/verify/README.md` or `/verify/_draft.md` could therefore be rewritten as a
scoped skill invocation plus a broken suffix.

Confirmed by source-to-plugin release fixtures covering uppercase and
underscore path names. The path guard now treats any slash immediately after a
known skill name as a path delimiter, while retaining transformation of a
standalone `/verify` invocation.

Ruled out:

- A plugin skill-name collision: the problem was parser boundary detection,
  not Codex discovery or plugin metadata.
- Link adaptation: sibling-document link relocation remains a separate,
  allowlisted transformation.
