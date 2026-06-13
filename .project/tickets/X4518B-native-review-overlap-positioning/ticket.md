---
id: X4518B
slug: native-review-overlap-positioning
type: feature
phase: intake
status: in_progress
epic: cc-changelog-alignment
relates_to: 8R54HV
created: 2026-05-31T21:05:09.536Z
last_modified: 2026-05-31T21:05:09.536Z
---

# Position safeword review skills vs native /code-review, /simplify, /goal, workflows

**Goal:** Decide how safeword's review/orchestration skills relate to the now-native CC equivalents — differentiate, delegate, or deprecate.

**Why:** CC shipped capable native review and orchestration in this window that overlap directly with safeword's `quality-review`, `audit`, `refactor`, and the multi-step workflow model. Maintaining parallel implementations is bloat unless safeword's versions do something native doesn't.

## Findings

- CC `2.1.120`: `claude ultrareview [target]` (`--json`, exit 0/1).
- CC `2.1.147`: renamed `/simplify` → `/code-review`; effort-based; `--comment` posts inline GitHub PR comments.
- CC `2.1.152`: `/code-review --fix` applies findings to the working tree; `/simplify` re-added as cleanup-only.
- CC `2.1.154`: `/simplify` is cleanup-only (reuse, simplification, efficiency, altitude) with auto-fixes; dynamic workflows orchestrating tens-to-hundreds of agents (`/workflows`).
- CC `2.1.139`: `/goal` completion condition — Claude continues across turns until a goal is met.

## Overlap with safeword

- `quality-review` / `audit` ↔ `/code-review`, `claude ultrareview`.
- `refactor` (cleanup) ↔ `/simplify`.
- Safeword's phase/ticket continuation + done gate ↔ `/goal`, `/workflows`.

## The call to make

Safeword's moat is **workflow enforcement** (phases, gates, TDD/BDD discipline, learnings, ticket context) — not the review prose itself. Three directions:

- **Differentiate:** keep safeword review skills, sharpen them on what native lacks (project-specific gates, learnings integration, ticket/phase awareness, deterministic exit criteria).
- **Delegate:** have safeword skills invoke native `/code-review`/`/simplify` under the hood and keep only the enforcement/gating layer on top. Less code to maintain; rides CC improvements.
- **Deprecate** the overlapping parts that native does as well or better, and document the native command as the recommended path.

Likely answer is a mix (delegate the generic review, keep the gating + learnings layer), but this needs a real decision — hence a feature ticket, not a patch.

## Investigation steps

1. Inventory exactly what `quality-review`, `audit`, `refactor` do that native `/code-review`/`/simplify`/`ultrareview` do not (capability diff, with current CC docs).
2. Same for `/goal`/`/workflows` vs safeword's phase continuation + done gate.
3. Decide direction per skill; if "delegate," prototype one (e.g., refactor → `/simplify`) to validate the seam.

## Done when

- A written positioning decision per overlapping skill (differentiate / delegate / deprecate), grounded in a capability diff against current CC.
- Follow-up implementation tickets filed for whichever direction is chosen.

## Out of scope

- Implementing the chosen direction here — this ticket produces the decision + follow-up tickets.

## Work Log

- 2026-05-31T21:05:09.536Z Started: Created ticket X4518B
- 2026-05-31 Catalogued native review/orchestration overlap (code-review, simplify, ultrareview, goal, workflows).
