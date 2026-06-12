# Test Definitions — upgrade-vehicle migration

Scenarios for child [9MMWS7](./ticket.md) of epic
[AQJ95G](../AQJ95G-project-namespace-default/spec.md). Lineage
`<jtbd-id>.AC<#>.<scenario_name>`; dimensions in [dimensions.md](./dimensions.md).

## Rule: A legacy install is offered the move, defaulting to yes

> Rationale: DEV1.AC1 — migration is the recommended default at the natural
> touchpoint (upgrade), one keystroke to accept.

### Scenario: upgrade-namespace-migration.DEV1.AC1.flag_migrates_legacy_install

Given a legacy-only install in a git repo with `.safeword-project/` tracked
When `safeword upgrade --migrate-namespace` runs
Then `.safeword-project/` is renamed to `.project/` with git history preserved (git status shows a rename, not delete+add), and `.safeword-project/` no longer exists

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: upgrade-namespace-migration.DEV1.AC1.prompt_accept_migrates

> Test seam: the prompt is an injected confirm function (unit layer) — a CI
> subprocess has no TTY, so the interactive pair is proven against the seam,
> not a pseudo-terminal. stdin EOF during the prompt resolves to a clean
> decline (never hangs, never crashes).

Given a legacy-only install whose migration prompt will be answered with the default (yes)
When `safeword upgrade` runs interactively
Then the namespace is moved to `.project/` and the upgrade continues on the new root

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: upgrade-namespace-migration.DEV1.AC1.untracked_dir_falls_back_to_rename

Given a legacy-only install in a directory that is not a git repo
When `safeword upgrade --migrate-namespace` runs
Then the namespace is moved to `.project/` via filesystem rename with all content intact

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The move never happens without consent

> Rationale: DEV1.AC2 — driver-locked: default and recommended, never silent,
> never forced. Declining costs nothing.

### Scenario: upgrade-namespace-migration.DEV1.AC2.prompt_decline_leaves_legacy_untouched

Given a legacy-only install whose migration prompt will be answered `n`
When `safeword upgrade` runs interactively
Then `.safeword-project/` is byte-unchanged, no `.project/` exists, and the upgrade completes normally on the legacy root

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: upgrade-namespace-migration.DEV1.AC2.decline_flag_skips_prompt_and_move

Given a legacy-only install
When `safeword upgrade --no-migrate-namespace` runs
Then no prompt is shown, no move happens, and the upgrade completes on the legacy root

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: upgrade-namespace-migration.DEV1.AC2.non_interactive_nudges_only

Given a legacy-only install and a non-interactive upgrade (no TTY, no migration flag)
When `safeword upgrade` runs
Then the output contains a one-line nudge naming `--migrate-namespace`, and no directories are moved

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: upgrade-namespace-migration.DEV1.AC2.move_failure_reports_and_changes_nothing

Given a legacy-only install where the rename target is blocked (a file named `.project` exists)
When `safeword upgrade --migrate-namespace` runs
Then the failure is reported naming the cause, `.safeword-project/` is byte-unchanged, and the upgrade completes on the legacy root

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: upgrade-namespace-migration.DEV1.AC2.current_install_gets_no_offer

Given an install already on `.project/`
When `safeword upgrade` runs non-interactively
Then no migration prompt, nudge, or move occurs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A completed migration is coherent end to end

> Rationale: DEV1.AC3 — the same run finishes on the new root; nothing keeps
> pointing at the old one.

### Scenario: upgrade-namespace-migration.DEV1.AC3.same_run_reconciles_on_new_root

Given a legacy-only install missing its glossary file
When `safeword upgrade --migrate-namespace` runs
Then `.project/glossary.md` is scaffolded by the same run and no `.safeword-project/` is recreated

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: upgrade-namespace-migration.DEV1.AC3.stale_per_file_overrides_rewritten

Given a legacy install whose `.safeword/config.json` sets `paths.personas` to `.safeword-project/personas.md`
When `safeword upgrade --migrate-namespace` runs
Then `paths.personas` reads `.project/personas.md` after the move

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: upgrade-namespace-migration.DEV1.AC3.configured_custom_root_not_offered

Given an install with `.safeword-project/` present on disk AND `.safeword/config.json` setting `paths.projectRoot` to a custom directory
When `safeword upgrade --migrate-namespace` runs
Then `.safeword-project/` is untouched, no `.project/` is created, and reconcile scaffolds into the configured root

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A half-finished state is surfaced, not guessed at

> Rationale: DEV1.AC4 — both-dirs is transient; the tooling names the
> finishing action instead of silently picking forever.

### Scenario: upgrade-namespace-migration.DEV1.AC4.both_dirs_refuses_move_and_advises

Given a repo with both `.project/` (containing a pre-existing user file) and `.safeword-project/` present
When `safeword upgrade --migrate-namespace` runs
Then `.safeword-project/` is byte-unchanged, the pre-existing `.project/` file is byte-unchanged, and the output explains `.project/` already exists (manual merge needed)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: upgrade-namespace-migration.DEV1.AC4.check_advisory_fires_on_both_dirs

Given a repo with both `.project/` and `.safeword-project/` present
When `safeword check` runs
Then a zero-exit advisory names the both-dirs state and the action to finish converging

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: upgrade-namespace-migration.DEV1.AC4.check_silent_on_single_root

Given a repo with only one namespace root present (either `.project/` only or `.safeword-project/` only)
When `safeword check` runs
Then no namespace advisory is emitted — declining migration never becomes a nag

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
