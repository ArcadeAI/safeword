# Spec: Agent surface refactor epic

## Intent

Reduce maintenance drift across Claude, Cursor, and Codex configuration surfaces while preserving each tool's native files and safeword's dogfooding model.

## References

- Claude Code skills: https://docs.anthropic.com/en/docs/claude-code/skills
- Claude Code hooks: https://docs.anthropic.com/en/docs/claude-code/hooks
- Cursor rules: https://cursor.com/docs/rules
- Cursor skills: https://cursor.com/docs/skills
- Codex customization: https://developers.openai.com/codex/concepts/customization
- Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Codex config: https://developers.openai.com/codex/config-basic
- Codex hooks: https://developers.openai.com/codex/hooks
- Codex skills: https://developers.openai.com/codex/skills

## Jobs To Be Done

### agent-surface-refactor.SM1 - Maintain aligned agent surfaces

**Persona:** Safeword Maintainer (SM)

When I update a safeword skill, command, rule, or hook adapter, I want the repeated Claude/Cursor/Codex files to derive from shared sources where possible, so I can make one intended change without missing a mirrored surface.

#### agent-surface-refactor.SM1.AC1 - Shared source candidates are explicit

Every repeated surface has either a child ticket with the selected shared-source approach or an explicit decision not to refactor it.

#### agent-surface-refactor.SM1.AC2 - Platform-native files remain intact

Claude, Cursor, and Codex still receive the files their current docs expect; this epic does not collapse platform-specific surfaces into one unsupported format.

#### agent-surface-refactor.SM1.AC3 - Drift-prone dogfood differences are tracked

Any installed dogfood file that differs from its template is either reconciled or documented as intentional.

## Outcomes

- Maintainers can add or update a skill without editing independent Claude and Codex registration lists.
- Cursor wrapper files remain present but are generated or checked from the same metadata as the skill they invoke.
- Required skill logging is a reusable behavior, not a repeated shell one-liner.
- The Codex hook adapter has pure logic that can be tested without spawning the deployed hook process.

## Figure-it-out decision record

### 1. Skill registration source

**Frame:** Decide whether duplicated Claude/Codex skill schema entries should be hand-maintained, generated from the existing Codex list, or generated from a new shared manifest.

**Research domains:** Claude skill discovery and command creation; Codex skill/package discovery; safeword schema ownership; dogfood install parity.

**Options:** hand-maintain both lists; use the current Codex list as the source; create a neutral skill manifest that expands to Claude and Codex targets.

**Recommend:** Create a neutral skill manifest. Claude and Codex both use directory-backed skill files, but the manifest should not be named after either tool. The current Codex list proves generated schema entries work; extending that pattern avoids privileging one platform.

**Next:** Create child Y06KJS and implement manifest expansion with schema parity tests.

### 2. Cursor wrappers

**Frame:** Decide whether Cursor wrapper files should stay manual, be generated, or be replaced by direct skills/rules.

**Research domains:** Cursor rules and skills; Cursor command file compatibility; safeword wrapper pattern; install reconciliation.

**Options:** keep manual wrappers; generate wrappers from metadata; delete wrappers and rely on shared skills.

**Recommend:** Generate wrappers from metadata while keeping physical files. Cursor still has distinct rule and command surfaces, and safeword already depends on those files for install. Generation fixes drift without betting on a new runtime behavior.

**Next:** Create child F1HTQ4 and add wrapper generation or drift tests.

### 3. Skill invocation logging

**Frame:** Decide whether repeated `verify`/`audit` log injections should stay inline, move to a helper script, or be handled by hook-side inference.

**Research domains:** Claude dynamic shell injection; hook done-gate evidence; namespace root resolution; least-surprise failure modes.

**Options:** keep inline shell; call one installed helper; infer invocation from generated artifacts.

**Recommend:** Call one installed helper. The done gate needs proof that the skill was invoked, and the existing helper code already owns log parsing. A writer helper keeps that proof explicit while removing duplicated shell.

**Next:** Create child 88QCHJ and add tests for helper output plus existing done-gate parsing.

### 4. Cursor verify drift

**Frame:** Decide whether the dogfood `.cursor/commands/verify.md` difference is acceptable customization or unintentional stale output.

**Research domains:** dogfooding as an upgrade signal; verify done-gate evidence; Gherkin acceptance lane requirements; template/install drift.

**Options:** reconcile to template; document as intentional local customization; add a drift check and decide later.

**Recommend:** Reconcile or document immediately. This is not an abstract refactor; the installed dogfood command lacks the Gherkin evidence phrase that the template says the done gate validates.

**Next:** Create child 1833FW and resolve the drift with a test or rationale.

### 5. Codex hook adapter helpers

**Frame:** Decide whether the Codex adapter should stay as one executable file, extract pure helpers, or become a generic adapter framework.

**Research domains:** Codex hook payloads and exit behavior; existing Claude hook contract; unit-test granularity; template deployment risk.

**Options:** keep one file; extract pure translation/denial helpers; build a generic cross-agent hook adapter framework.

**Recommend:** Extract pure helpers only. Translation and denial parsing are stable enough to test directly; a generic framework would add abstraction before there is a second adapter with the same shape.

**Next:** Create child W0E292 and keep the executable adapter behavior byte-compatible.

### 6. Fake Codex CLI fixtures

**Frame:** Decide whether duplicated fake Codex CLI setup should be shared across Cucumber and Vitest.

**Research domains:** test fixture boundaries; Cucumber step runtime; Vitest helper coupling; maintenance payoff.

**Options:** leave duplication; extract only fake binary creation; merge all Codex project setup helpers.

**Recommend:** Extract only fake binary creation if the child finds another use. The two test harnesses have different setup responsibilities, so sharing the entire fixture would couple unrelated test layers.

**Next:** Create child 6SE3MR and keep it explicitly low priority.

### 7. Versioning skill ownership

**Frame:** Decide whether `.claude/skills/versioning` is intentional Claude-only content, missing from templates, or obsolete.

**Research domains:** Claude skill discovery; Codex/Cursor parity promises; safeword ticket naming/version workflow; dogfood-only config.

**Options:** record Claude-only rationale; promote to templates and Codex/Cursor surfaces; remove as stale dogfood.

**Recommend:** Decide before refactoring. The file exists only in dogfood, so changing it as part of a generation refactor would silently make a product decision.

**Next:** Create child 2YZDKQ and record the ownership decision before touching generation code.
