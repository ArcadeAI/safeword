# Current retrospective model verification

Branch: `codex/refresh-retro-models`, based on merged main `cfe93e30c`.
This is local implementation evidence, not a published release or full-suite
completion claim.

## Change and scope

Codex defaults to `gpt-6-astra`, resolved from official current OpenAI guidance
on 2026-10-17. Claude stays on the latest `sonnet` alias; Cursor stays on `auto`.
Explicit `retro.model` overrides, prompts, containment, auth, and PR review
models are unchanged. Historical explicit-model forwarding fixtures remain.

## Results

- RED: the two updated default-selection cases failed against gpt-5.5.
- GREEN: all 141 tests in the retrospective command and extraction files pass.
- Smoke: all 2,174 tests across 103 files pass.
- Live: real `buildAutoExtractor`, no model override, ChatGPT-authenticated
  Codex CLI 0.163.0 and the repository's pinned 0.160.0, existing strict findings
  schema and read-only containment:
  both a no-friction transcript (empty result) and a planted Safeword bug
  (nonempty validated finding) return `checked.ok: true`. No issues were filed.
- All five generated surfaces regenerated and freshness check passes; lifecycle
  result hashes stay unchanged, while installed-tree/template hashes update.
- Dogfood install succeeds; all 276 parity pairs and 11 contracts pass.
- All three packages typecheck. Repository ESLint exits zero with no warnings;
  formatting is unchanged.
- A diagnostic lint forced on the normally excluded template reports 22 errors
  identical to the base revision; comparison has no differences. No baseline
  lint policy or unrelated template implementation was changed.

## Independent review

Claude/Opus review `01aeb397-9483-4dbb-9ad4-3c2c7f3edb90` approved the source
and tests without errors. Its evidence suggestions were applied: attached
static/generated results and ran the nonempty strict-schema live probe.
The earlier minimal model-access probe is explicitly distinguished from real
retrospective output. Refreshed review
`5992a59f-f21c-46a5-ac21-620e9d8d56f9` approved all changed source, tests,
mirrors and metadata. The coordinator excluded only the two oversized generated
CLI bundles, covered by successful regeneration/freshness. Its existing shared
override concern and optional repeated-failure diagnostics are outside this
bounded default update; routing and override semantics deliberately stay intact.

## Evidence and limits

Logs in `.project/tmp/`: `retro-model-red.log`, `retro-model-green.log`,
`retro-model-smoke.log`, `retro-model-live.ts`, `retro-model-live-result.json`,
`retro-model-generate.log`, `retro-model-freshness.log`, `retro-model-parity.log`,
`retro-model-types.log`, `retro-model-eslint.log`, and the two matching
`retro-model-template-lint` diagnostic logs.

Full authoritative verification, CI, release, and cached-plugin deployment
have not run for this branch. Existing installed plugin caches are untouched.
Live probes establish access and schema compatibility, not a broad model
quality benchmark or all-account availability guarantee.
