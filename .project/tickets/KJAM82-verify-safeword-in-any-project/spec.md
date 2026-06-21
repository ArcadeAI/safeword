# Spec: Verify safeword in any project

## Intent

Safeword's quality workflows should behave correctly after installation into arbitrary projects, not only inside the dogfood repo. `/verify`, `/audit`, and related guidance should inspect the target project, run supported checks, and fall back to explicit manual evidence when automation is not available.

## References

- Conversation correction: safeword root files in this repo are dogfood installed output and will be overwritten by upgrade.
- Existing project-aware command logic: `packages/cli/templates/hooks/lib/test-runner.ts`.
- Existing narrow follow-up: `C25VKV-align-verification-commands-with-monorepo-scripts`.
- Related current work: `HMZSCD-let-codex-verify-task-tickets-without-claude-session-proof`, `K2ZP40-let-codex-earn-self-review-stamps-without-render-time-shell`.

## Personas

- Technical Builder (TB)
- Safeword Maintainer (SM)

## Vocabulary

- Installed project: the customer repository where safeword has been set up.
- Dogfood output: this repo's installed `.safeword/`, `.agents/`, `.claude/`, and `.cursor/` files, refreshed from templates by upgrade.
- Target-project verification: checks that prove the customer's code changed safely, using that project's own available tools.
- Safeword runtime verification: checks that prove safeword's own hooks and helpers can run.

## Jobs To Be Done

### verify-safeword-any-project.DEV1 - Finish work without false verification failures

**Persona:** Technical Builder (TB)

> When I use safeword in a Go, Python, Rust, npm, pnpm, yarn, Bun, or minimal project, I want `/verify` to run the checks my project actually supports, so I can trust the done gate instead of debugging missing scripts from another stack.

#### verify-safeword-any-project.DEV1.AC1 - Verification uses available project commands

`/verify` detects the installed project's runnable checks before choosing commands and does not require absent scripts such as `build`, `test`, or `test:bdd`.

#### verify-safeword-any-project.DEV1.AC2 - Unsupported automation asks for evidence

When safeword cannot identify an automated verification command, `/verify` records the gap and asks for explicit manual evidence instead of manufacturing a failing command.

#### verify-safeword-any-project.DEV1.AC3 - Safeword runtime stays separate from project runtime

Safeword can still require Bun for its hooks while avoiding the implication that the target project itself must use Bun.

### verify-safeword-any-project.SM1 - Ship template changes through dogfood

**Persona:** Safeword Maintainer (SM)

> When I change safeword's installed workflows, I want the templates and dogfood copies to stay aligned, so customer upgrades receive the same behavior proven in this repo.

#### verify-safeword-any-project.SM1.AC1 - Templates are the source of truth

Durable fixes land in `packages/cli/templates/` first, and installed dogfood files are refreshed from those templates rather than hand-edited as the permanent source.

#### verify-safeword-any-project.SM1.AC2 - Regression fixtures cover stack variety

Tests cover no-build JavaScript, non-Bun JavaScript, and non-JavaScript installed projects so the stack-agnostic promise cannot regress silently.

#### verify-safeword-any-project.SM1.AC3 - Audit language matches project evidence

`/audit` and related quality guidance distinguish stack-generic checks from JavaScript-specific checks and only require JS-specific commands when project evidence supports them.

## Outcomes

- `/verify` stops treating missing Bun scripts as proof that an arbitrary installed project is unhealthy.
- `/audit` remains rigorous for JavaScript projects without overstating JavaScript checks for non-JavaScript projects.
- Dogfood upgrade remains the proof path: templates change first, installed files are refreshed, and byte-alignment checks confirm the output.
- Future child tickets can be cut from the acceptance criteria without redefining the epic.

## Open Questions

None yet.
