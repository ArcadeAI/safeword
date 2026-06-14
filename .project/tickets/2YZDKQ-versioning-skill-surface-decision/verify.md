# Verify: Clarify versioning skill ownership

## Result

PASS - `versioning` is recorded as a Claude-local maintainer-only skill, not missing customer-facing template content.

## Evidence

- Decision recorded in `ticket.md`: keep `.claude/skills/versioning/SKILL.md` local to safeword maintainers.
- Skill content checked: `audience: maintainer`; release discipline, semver policy, tag/CI publish procedure, and npm verification.
- Version workflow checked: `.safeword/hooks/session-auto-upgrade.ts` references version policy; `packages/cli/tests/utils/version.test.ts` pins patch/minor auto-apply and major notify behavior.
- Parity expectation checked: `packages/cli/tests/schema.test.ts` excludes `audience: maintainer` skills from customer-facing template drift detection.
- Epic updated: Y06KJS must exclude maintainer-only dogfood skills from shared customer-facing manifests.

## Tests

- `./node_modules/.bin/vitest run --configLoader runner tests/schema.test.ts tests/utils/version.test.ts` from `packages/cli/` - 44 passed
