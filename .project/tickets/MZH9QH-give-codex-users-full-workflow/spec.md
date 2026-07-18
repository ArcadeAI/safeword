# Spec: Give Codex users the full Safe Word workflow

## Intent

Codex users should receive every Safe Word workflow and its supporting phase material through the profile-scoped Safe Word plugin. The plugin must provide behavioral parity with the canonical workflow content without placing agent skill files in the user's repository.

## Intake Brief

- **Requested by:** Safe Word product owner.
- **Cost of inaction:** Codex users receive only three thin skills while Claude Code and Cursor receive the complete workflow. Referenced BDD material is absent after plugin migration, which makes the experience incomplete and leaves parity checks unable to prove the intended behavior.
- **Reversibility:** The generated plugin catalogue and its adapter are cross-cutting release behavior, and migration cleanup is a public CLI contract. Both can be rolled back in a later release; no user data migration is required.

## References

- `migrate-codex-to-plugin (YH2ZRN)` established the profile-scoped plugin and deliberately removed repository-installed Codex workflow files.
- Official Codex documentation: [Build skills](https://learn.chatgpt.com/docs/build-skills) and [Build plugins](https://learn.chatgpt.com/docs/build-plugins).
- `packages/cli/templates/skills/` is the canonical Safe Word workflow catalogue.

## Personas

- Technical Builder (TBU)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- OpenAI Codex
- Safeword CLI

Unaffected:

- Claude Code - continues to receive the canonical workflow from project-installed templates.
- Cursor - continues to consume the existing Claude-compatible workflow references.
- OpenAI Codex Cloud - profile-scoped local plugins are not available in cloud containers.

## Vocabulary

- **Canonical skill catalogue:** The complete set of Safe Word workflow documents under `packages/cli/templates/skills/`.
- **Plugin skill bundle:** A Codex plugin skill directory containing one `SKILL.md` entry point and any supporting reference files.
- **Reference asset:** Supporting workflow material that a skill dispatches to during a later phase, such as BDD discovery or scenario guidance.

## Jobs To Be Done

### codex-workflow.TBU1 - Follow the complete Safe Word process in Codex

**Persona:** Technical Builder (TBU)

> When I use Codex to build software with Safe Word, I want every relevant workflow and phase reference available through the Safe Word plugin, so I get the same disciplined process without Safe Word adding workflow files to my repository.

#### codex-workflow.TBU1.R1 - Every canonical workflow is available with the reference material it dispatches to

#### codex-workflow.TBU1.R2 - A project's Safe Word workflow files stay outside the repository throughout Codex setup and migration

#### codex-workflow.TBU1.R3 - Migration retains legacy Safe Word hooks until the builder explicitly completes the trusted-plugin handoff

#### codex-workflow.TBU1.R4 - An unreviewed or changed Safe Word plugin hook is visibly skipped until the builder trusts it in Codex

### workflow-maintenance.SWM1 - Ship one workflow consistently across agents

**Persona:** Safeword Maintainer (SWM)

> When I update a Safe Word workflow, I want the Codex plugin derived from the canonical workflow catalogue, so the released plugin cannot silently diverge from the behavior delivered to other agents.

#### workflow-maintenance.SWM1.R1 - The packaged Codex catalogue is a deterministic, allowlisted transformation of the canonical workflow catalogue

#### workflow-maintenance.SWM1.R2 - A published package contains every generated skill and reference asset

#### workflow-maintenance.SWM1.R3 - Isolated Codex installation proves the cached plugin exposes the generated workflow without project-local workflow assets

#### workflow-maintenance.SWM1.R4 - Plugin hook commands use version-pinned Bunx and never bypass Codex hook trust

## Rave Moment

skip: table-stakes

## Outcomes

- Codex exposes every canonical Safe Word skill and every reference asset that its workflow needs.
- A Codex project remains free of installed Safe Word workflow files.
- A release check prevents the plugin catalogue from drifting from its canonical source or being omitted from the packed package.
- An isolated Codex installation proves the cached plugin exposes its skills and retains their reference assets without creating `.agents/`, `.codex`, or `.safeword` in the target project.
- Migration never removes legacy Safe Word Codex hooks while the new plugin hooks could remain untrusted.
- Codex visibly warns when a Safe Word hook needs review, and Safe Word neither suppresses that warning nor bypasses the trust check.

## Delivery Contract

Parity is semantic, not byte-for-byte: the Codex output must preserve each workflow's meaning while making only these explicit transformations:

- Keep Codex-supported skill metadata (`name` and `description`) and omit source-only metadata.
- Move non-entry workflow documents into the owning skill's `references/` directory.
- Rewrite references to Safe Word skills as the installed `safeword:<name>` skill names.
- Rewrite links to sibling workflow documents to their packaged `references/` locations.

Any other content difference is drift and must fail the source-to-plugin contract. The generated name, description, and path inventory must stay within Codex's documented 8,000-character fallback discovery budget. Codex may apply a smaller dynamic budget and omit skills from the initial list, so the contract guarantees complete installed availability and explicit scoped invocation, not universal implicit discovery.

An isolated live smoke without a trust-bypass flag must prove Codex's visible review-required warning for untrusted hooks. A bypassed smoke may prove packaged command dispatch only; it must never be reported as hook-trust proof.

## Open Questions

None. The migration handoff is two-step: installation enables the profile plugin but retains legacy hooks; after the builder reviews and trusts the plugin in Codex, an explicit cleanup action retires those hooks. The cleanup command accepts the builder's explicit confirmation; it does not and cannot inspect undocumented Codex trust state. Codex's supported hook-review flow is the source of truth: it skips untrusted or changed hooks and tells the builder to use `/hooks`. Safe Word will not read or mutate that state or use the bypass flag.
