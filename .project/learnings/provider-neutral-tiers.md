# Provider-neutral guidance: name tiers, never models

Covers: model-tier-selection (Z4Q24Q), shipped skill guidance, quality-review and BDD review-gate model rules, cross-provider authoring (Claude Code / Codex / Cursor).

## The rule

Safeword's shipped skills and normative policy name **capability tiers — frontier / mid / small — never specific models.** No `Fable`/`Opus`/`Sonnet`/`Haiku`, no `claude-*` ids, in any guidance that installs into a user's repo or governs behavior. Express the tier; let the harness/provider resolve tier → concrete model at runtime.

## Why

- **Cross-provider.** Safeword runs on Claude Code, Codex, and Cursor — each with its own models. A rule that says "use Opus" is meaningless (or wrong) on a non-Claude provider.
- **Release churn.** Model names, versions, and even capability orderings change every release; tier roles (hardest-autonomous / strong-reasoning / fast-cheap) don't.
- It's already the shipped convention: the quality-review and BDD review-gate guidance say "capability class — e.g. frontier vs mid vs small" for exactly this reason.

## Exception

The `claude-api` skill names models on purpose — it _is_ the Claude API reference (model ids, pricing, migration guidance). That's provider-specific reference material, not safeword's normative guidance. The rule governs safeword's own behavioral guidance, not a reference doc whose subject is one provider's API.

## Corollary — don't hardcode tier→model in code

Resist gate-enforcing tier rules by baking a model→tier ranking into hooks (e.g. making `crossModelReview` fail-closed on a "weaker" reviewer). That re-introduces a model list in code: brittle on every release and bound to one provider's lineup. Tier→model resolution belongs in provider config the harness owns. This is why Z4Q24Q's no-weaker floor ships as guidance, not gate enforcement.
