# Test Definitions: Distribute Quality Gate Hooks

## T1: Template Files Exist

- [ ] **Given** a fresh `packages/cli/templates/hooks/` directory
      **When** listing all hook template files
      **Then** `post-tool-quality.ts`, `pre-tool-quality.ts`, `pre-tool-config-guard.ts`, `post-tool-bypass-warn.ts`, and `lib/quality-state.ts` are present

## T2: Schema Registers Hook Files as Owned

- [ ] **Given** `SAFEWORD_SCHEMA.ownedFiles` in `schema.ts`
      **When** checking for quality gate hook entries
      **Then** all 5 files are registered with correct template paths

## T3: SETTINGS_HOOKS Includes PreToolUse and Additional PostToolUse

- [ ] **Given** `SETTINGS_HOOKS` in `config.ts`
      **When** checking registered hook events
      **Then** `PreToolUse` event exists with matcher `Edit|Write|MultiEdit|NotebookEdit` pointing to `pre-tool-quality.ts`
      **And** `PreToolUse` has a second entry with matcher `Edit|Write|MultiEdit|NotebookEdit` pointing to `pre-tool-config-guard.ts`
      **And** `PostToolUse` has entries for `post-tool-lint.ts`, `post-tool-quality.ts`, and `post-tool-bypass-warn.ts`

## T4: PostToolUse Quality Observer Matcher Includes Bash

- [ ] **Given** `post-tool-quality.ts` registered in `SETTINGS_HOOKS`
      **When** checking its matcher
      **Then** matcher includes `Bash` (for commit detection) in addition to edit tools

## T5: PreToolUse Quality Enforcer Uses JSON API

- [ ] **Given** the distributed `pre-tool-quality.ts` template
      **When** blocking an edit (LOC gate, refactor gate, or phase gate)
      **Then** it outputs JSON with `hookSpecificOutput.permissionDecision: "deny"` on stdout
      **And** exits with code 0 (not exit 2)

## T6: Setup Installs Quality Hooks in Consumer Project

- [ ] **Given** a new project running `safeword setup`
      **When** setup completes
      **Then** `.safeword/hooks/pre-tool-quality.ts` exists
      **And** `.safeword/hooks/post-tool-quality.ts` exists
      **And** `.safeword/hooks/pre-tool-config-guard.ts` exists
      **And** `.safeword/hooks/post-tool-bypass-warn.ts` exists
      **And** `.safeword/hooks/lib/quality-state.ts` exists
      **And** `.claude/settings.json` contains `PreToolUse` hook entries
      **And** `.claude/settings.json` contains additional `PostToolUse` hook entries

## T7: Upgrade Adds Quality Hooks to Existing Consumer Project

- [ ] **Given** a project on v0.18.0 without quality hooks
      **When** running `safeword upgrade` to next version
      **Then** all 5 hook files are created
      **And** `.claude/settings.json` is updated with new hook registrations
      **And** existing non-safeword hooks in settings.json are preserved

## T8: Existing Config Test Assertions Updated

- [ ] **Given** `config.test.ts` SETTINGS_HOOKS tests
      **When** running the test suite
      **Then** test asserts `PreToolUse` event exists
      **And** test validates PostToolUse quality observer matcher includes `Bash`
      **And** all hook commands reference `$CLAUDE_PROJECT_DIR`
