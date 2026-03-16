# Test Definitions: Rename /done to /verify

## T1: /verify Command Exists, /done Removed

- [ ] **Given** the distributed command templates
      **When** listing `.claude/commands/` and `.cursor/commands/`
      **Then** `verify.md` exists in both
      **And** `done.md` does not exist in either

## T2: /verify Runs Without Ticket Context

- [ ] **Given** a project with no active ticket
      **When** running `/verify`
      **Then** tests, build, and lint run and report results
      **And** scenario check is skipped (no ticket)
      **And** dependency drift check runs against ARCHITECTURE.md

## T3: /verify Reports Scenario Completion With Ticket

- [ ] **Given** a project with an active ticket and test-definitions.md
      **When** running `/verify`
      **Then** tests, build, lint run
      **And** scenario count reports "X/Y complete"
      **And** evidence pattern `✓ X/X tests pass` appears in output

## T4: Dependency Drift Detection — New Dep Not in ARCHITECTURE.md

- [ ] **Given** `package.json` has `@tanstack/query` in dependencies
      **And** `ARCHITECTURE.md` does not mention `@tanstack/query` or `tanstack`
      **When** running `/verify`
      **Then** output flags: "Dependency `@tanstack/query` not documented in ARCHITECTURE.md"

## T5: Dependency Drift Detection — No False Positives

- [ ] **Given** `package.json` has `vitest` in devDependencies
      **And** `ARCHITECTURE.md` mentions `vitest`
      **When** running `/verify`
      **Then** no drift warning for `vitest`

## T6: Dependency Drift Detection — No ARCHITECTURE.md

- [ ] **Given** a project without ARCHITECTURE.md
      **When** running `/verify`
      **Then** dependency drift check is skipped (no baseline to compare against)
      **And** no error or crash

## T7: Stop Hook Requires Audit Evidence for Done Phase

- [ ] **Given** a feature ticket in `phase: done`
      **And** transcript contains test evidence `✓ X/X tests pass`
      **And** transcript contains scenario evidence `All N scenarios marked complete`
      **But** transcript does NOT contain audit evidence (`Audit passed` or `Audit passed with warnings`)
      **When** stop hook fires
      **Then** hard block (exit 2) with message requiring `/audit` to be run

## T8: Stop Hook Accepts Both Verify + Audit Evidence

- [ ] **Given** a feature ticket in `phase: done`
      **And** transcript contains test evidence AND scenario evidence
      **And** transcript contains audit evidence (`Audit passed` or `Audit passed with warnings`)
      **When** stop hook fires
      **Then** ticket is marked `status: done`
      **And** hierarchy navigation proceeds

## T9: DONE.md Skill References /verify Not /done

- [ ] **Given** the distributed `DONE.md` skill file
      **When** reading its content
      **Then** it references `/verify` (not `/done`)
      **And** it references `/audit` as a required step

## T10: Schema Registration Updated

- [ ] **Given** `SAFEWORD_SCHEMA.ownedFiles` in schema.ts
      **When** checking command entries
      **Then** `.claude/commands/verify.md` is registered
      **And** `.cursor/commands/verify.md` is registered
      **And** `done.md` entries are in `deprecatedFiles` (not ownedFiles)

## T11: Setup/Upgrade Distributes /verify to Consumer Projects

- [ ] **Given** a consumer project on previous version with `/done`
      **When** running `safeword upgrade`
      **Then** `verify.md` is created in `.claude/commands/` and `.cursor/commands/`
      **And** `done.md` is removed from both directories
