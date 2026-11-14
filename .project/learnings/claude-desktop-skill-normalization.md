# Claude desktop normalizes exposed skill front matter

Covers: Claude desktop organization plugin sync, skill integrity, semantic hashes.

Claude desktop's organization plugin sync rewrites folded descriptions in
`skills/*/SKILL.md` into single-line YAML. Raw byte hashing rejects these valid
copies even after reinstall. In #6004, 16 of 24 real desktop skill files changed
bytes while all 24 retained the same parsed metadata and body.

`src/claude-plugin/asset-integrity.ts` owns the compatibility rule for catalogue
generation, hook dispatch, and status. Preserve raw hashes, and accept the
optional `skill_sha256` only for exposed skill files. It includes parsed YAML
metadata and the exact body. Ignoring front matter entirely would miss changed
tool permissions and invocation policy. Runtime files and canonical templates
remain byte-exact; malformed YAML fails closed.

Compare samples from the same plugin version. The desktop organization copy
can be newer than `~/.claude/plugins/cache/`; check each `identity.json` before
attributing body differences to host normalization.

Regression coverage: `tests/claude-plugin/asset-integrity.test.ts`,
`dispatch.test.ts`, and `profile-install.test.ts` in `packages/cli/`.
