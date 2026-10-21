# Repair the Markdown dependency audit for maintainers

Scope: dependency-only patch from main `150eb7c619b2d5852174da99ba675ae326354153`.
Keep scenario PR #5994 separate. Do not change audit ignores, CI policy, templates,
generated carriers, or the deferred #4200 qualification and #5086 fallback work.

## Review plan

Check the security floor against the vendor advisory; verify the resolved artifact
and its integrity against npm; inspect the entire manifest and lockfile delta for
unrelated upgrades; verify the real markdownlint dependency resolution and its
ability to accept valid Markdown and reject an empty link. Full tests and root
lint are running separately; no terminal result is claimed here.

## Sources checked on 2026-10-20

- Vendor advisory: <https://github.com/markdown-it/markdown-it/security/advisories/GHSA-r7fv-28h4-cvq7>.
  The affected 14.x range is below 14.3.2; exploitation requires typography enabled
  and crafted untrusted Markdown. Audit failure alone does not establish application
  exposure. The existing CI command fails on clean main (exit 1), then passes after
  this patch (exit 0), retaining both existing advisory ignores.
- Upstream changelog: <https://github.com/markdown-it/markdown-it/blob/14.3.3/CHANGELOG.md>.
  14.3.2 and 14.3.3 backport security fixes. Retain the existing 14.x major override;
  raise its floor to `^14.3.2`. Bun resolves 14.3.3.
- `npm view markdown-it@14.3.3 version dist.integrity --json` confirms 14.3.3 and
  `sha512-L//tDAkjTjJCU6pBUSBTgs3Kg4InVaZuUZog/b6V12UKhcDQ7S78877ibbCanRExwPuYP1CZD7Gd2dxSy1GXRg==`.

## Exact review boundary

The review service rejects the 343758-byte `bun.lock` (262144-byte target limit).
`lockfile.diff` contains the complete `git diff -- bun.lock` from the base above;
the whole updated lockfile SHA-256 is
`f4ec5a840d9469ef611c4b0d23572d228f69580c8aeda6e1ec8e956045969c02`.
Review `package.json` and this exact delta together. The delta changes only the
markdown-it override and resolved artifact/integrity. Unchanged lockfile entries
were not independently reviewed.

## Observations and limits

- Exact CI audit: `scripts/dev bun audit --audit-level high --ignore GHSA-vfj7-8cjw-p6xm --ignore GHSA-ch52-4w7c-c8xp`.
  Before: exit 1, one high markdown-it advisory. After: exit 0. Raw outputs retained.
- `bun install --frozen-lockfile --ignore-scripts`: exit 0, but an incremental
  install left markdownlint-cli2 resolving a stale 14.3.0 local dependency.
  A forced frozen reinstall repaired the local tree; the installed consumer now
  resolves 14.3.3. No lockfile changes resulted from reinstalling.
- A real Markdown render produces the expected heading and bold paragraph.
  markdownlint-cli2 stdin accepts valid Markdown (exit 0) and rejects an empty
  link with MD042 (exit 1). File-name probes reported zero files and are not
  counted as behavior evidence.
- A first regression run was interrupted (exit 130) because dependency reinstall
  overlapped it. The initial root lint run failed with MODULE_NOT_FOUND during
  reinstall. Both logs are preserved and neither is green evidence. Fresh checks
  began only after the repaired resolution was confirmed.
- Safeword profile retry failed: installer expected 1.1.0 while Codex reported
  1.2.0; project hooks were left unchanged. Existing review coordinator remains
  available. This patch does not claim to repair profile installation.
- No new product path or application implementation is introduced. Existing CI
  audit is the discriminating failing-then-passing check; no version-string unit
  test is added. The upstream security implementation is not reimplemented here.
- No paid native qualification rerun. No release or merge authorization for this
  patch or #5994; keep both Draft. Revert both manifest and lockfile to roll back.
