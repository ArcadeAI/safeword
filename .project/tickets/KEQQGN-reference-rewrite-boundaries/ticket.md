---
id: KEQQGN
slug: reference-rewrite-boundaries
type: task
phase: intake
status: in_progress
created: 2026-08-20T23:06:48.319Z
last_modified: 2026-08-20T23:06:48.319Z
---

# Bound the Codex reference-path rewrite to real Markdown links

**Goal:** Make adaptSkillBody rewrite only genuine relative reference links, leaving already-prefixed paths, URLs, and prose mentions alone

**Why:** The rewrite is an unrestricted global substring replace, so any occurrence of a sibling reference filename is rewritten - an already-prefixed references/NAME.md becomes references/references/NAME.md, a URL ending in that filename is corrupted, and prose mentions are silently turned into paths. Raised twice by independent Codex review

## The mechanism

`adaptSkillBody` in `packages/cli/src/codex-plugin/catalogue.ts`:

```ts
for (const referenceName of referenceNames) {
  adapted = adapted.split(referenceName).join(`references/${referenceName}`);
}
```

`referenceNames` are the sibling `.md` filenames in a skill directory. The
replacement is unanchored and unconditional: every occurrence of that filename
anywhere in the body is rewritten, with no notion of whether it is a link, a
URL, or ordinary prose.

## Reproduced

A fixture skill whose sibling reference is `TDD.md`, generated at `1.2.3`:

| Source line | Generated |
| --- | --- |
| `Plain link: TDD.md` | `Plain link: references/TDD.md` ✅ intended |
| `Already prefixed: references/TDD.md` | `references/references/TDD.md` ❌ |
| `In a URL: https://example.com/docs/TDD.md` | `.../docs/references/TDD.md` ❌ |
| `In prose: the TDD.md file explains it` | `the references/TDD.md file explains it` ❌ |

A fourth hazard is order-dependence: sibling names where one is a substring of
another (`TDD.md` inside `X-TDD.md`) would corrupt the longer name when the
shorter is replaced first.

## Not currently reachable

Verified against the real corpus on 2026-08-20:

- No `references/references/` anywhere in `packages/cli/codex-plugin/`.
- No `https?://…\.md` URLs in `templates/skills/`.
- No sibling reference filename is a substring of another in any skill.

So nothing ships broken today. The hazard is that all three preconditions are
ordinary things to write — a doc author adding a URL to an upstream `.md`, or
pre-writing a `references/` path, silently corrupts the generated Codex skill.

## Provenance

Raised twice by independent Codex review, in two separate sessions, against
different file sets. It was set aside the first time as pre-existing and
out-of-scope for the change under review — which was true both times, and is
why it needs its own ticket rather than a third dismissal.

## Direction

Rewrite only genuine relative reference links. Minimum viable shape:

- Skip an occurrence already preceded by `references/`.
- Skip occurrences inside an absolute URL.
- Require a path boundary before the filename, so a longer token containing it
  is not matched.
- Process sibling names longest-first to remove the substring ordering hazard.

A stricter alternative is to parse Markdown link targets and rewrite only those,
which is more correct but heavier than this corpus needs.

## Out of scope

- Workflow invocation rewriting (`adaptWorkflowInvocations`) — separate pass,
  already boundary-aware.
- Whether references should live in a subdirectory at all.

## Work Log

- 2026-08-20T23:06:48.319Z Started: Created ticket KEQQGN
