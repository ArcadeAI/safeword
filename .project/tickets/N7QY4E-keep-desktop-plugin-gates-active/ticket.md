---
id: N7QY4E
slug: keep-desktop-plugin-gates-active
type: task
phase: verify
status: in_progress
subtype: bug-investigated
external_issue: https://github.com/ArcadeAI/safeword/issues/6004
scope: Accept equivalent YAML front matter for exposed Claude plugin skills
out_of_scope: Desktop cache discovery, release, and relaxing runtime integrity
done_when: Normalized skills execute hooks and report healthy; content changes remain rejected
created: 2026-10-21T15:05:13.253Z
last_modified: 2026-10-21T15:05:13.253Z
---

# Keep quality gates active for Claude desktop users

**Goal:** Accept equivalent skill front matter after organization sync while rejecting changed skill content and runtime files

**Why:** Claude desktop normalizes skill YAML and raw byte hashes disable every Safeword hook

## Work Log

- 2026-10-21T15:05:13.253Z Started: Created ticket N7QY4E
- Reproduced the reported failure through the generated dispatcher before changing implementation.
- Committed the fix as `c0af11ddb`; independent Claude review approved it.
- Full CLI suite: 707 files, 11,534 tests passed; root lint, build, and types passed.
- Compared all 24 real desktop skills with the current generated plugin: all semantic digests match, including 16 byte-different skills.

## Root Cause

The catalogue seals every asset using raw SHA-256. Both `verifyInventoryAsset`
and `assertInstalledAsset` compare only those bytes. Claude desktop's YAML
reserialization changes the exposed skill header, so validation aborts before
hook execution. The real local desktop audit skill has the issue's exact hash
`70b579ab248ff746ec1a76653439621836f66ffb44f64f9343e84c5254e6b213`;
the original has `5150538ef9cf5932420de5ab413980a23bf82f087461296a74c4f29f8bf9087b`.
Their new semantic digests match. This rules out a cache-root mismatch or
random reinstall damage as the cause of this specific rejection.

Keep raw hashes for compatibility and add an optional semantic skill digest,
computed from parsed metadata and the exact body. Use one helper in generation,
dispatch, and status. Do not ignore front matter: metadata changes affect tools
and invocation policy. Limit normalization to exposed `skills/*/SKILL.md`.

Equivalence uses the installed `yaml` 2.9.0 parser, YAML 1.2 core schema, typed
JSON values with sorted mapping keys, and the exact text after the closing
delimiter's newline. Invalid or ambiguous YAML fails closed. Arrays retain
their order. Older inventories without the additional digest remain byte-exact.

## Tests

- [x] RED: reproduce normalized audit skill disabling generated hooks.
- [x] GREEN: normalized skill runs and records execution proof.
- [x] Status accepts the same normalized cache.
- [x] Metadata/body/runtime mutations and malformed YAML remain rejected.
- [x] Generated surfaces, types, lint, and relevant plugin suites pass.
