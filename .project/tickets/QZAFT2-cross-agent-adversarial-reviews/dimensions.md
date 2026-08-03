# Dimensions — cross-agent adversarial reviews

## Coverage matrix

| Dimension | Partitions and boundaries | Existing proof to reuse | New behavior to prove |
| --- | --- | --- | --- |
| Author → reviewer pairing | Claude → Codex; Codex → Claude; same-agent candidate; Cursor excluded | `crossModelReview` different-model rejection in 7A0B2K/MR5M3A | deterministic opposite-vendor selection and same-vendor rejection |
| Class-1 surface | quality review; scenario/phase review; implementation-plan/architecture review | NMSD94 phase stamps; existing skill-specific rubrics | every in-scope surface enters one coordinator contract |
| Runtime surface | desktop profile login; cloud managed login; supported environment credential; no valid credential | Claude/Codex retro parity and cloud-safe argv | both author directions work without requiring a manually copied API key |
| Preferred-route result | valid review; executable missing; authentication missing/expired; non-zero exit; timeout; malformed output | retro subprocess failure parsing and synchronous waits | fail-closed classification and safe fallback instead of retro's fail-open silence |
| Fallback posture | host-native fallback permitted; hard cross-agent requirement; no route remains | existing native fresh reviewer and explicit review-stamp skip | honest degraded evidence, hard-gate rejection, and terminal blocking |
| Isolation | bounded snapshot; neutral cwd; denied writes; vendor-scoped environment; hostile write/secret request | retro neutral cwd, read-only argv, child sentinel | no source-worktree mutation and no author-vendor credential exposure |
| Provenance | author agent; reviewer agent; assigned model; cross-agent/degraded level; legacy stamp | content-bound stamps, assigned model tag, legacy parser | agent identity and independence level, including backward compatibility |
| Builder message | independent success; degraded completion; blocked; technical diagnosis | NTB plain-language contract and existing hook errors | lead with independence status and one recommended recovery action |
| Rollout | staged guard; final default-on preference; explicit opt-out | review flags fail-safe to off during rollout | staged safety without leaving the requested feature permanently disabled |
| Unchanged routing | class-2 deterministic observation; class-3 producer fan-out; per-step TDD self-check | reviewer-class taxonomy and current skills | prove the coordinator is not invoked for excluded classes |

## Boundary decisions

- A missing opposite executable and a present-but-unauthenticated executable are different failures and require different recovery actions.
- A successful same-agent fresh review is not equivalent to a successful cross-agent review.
- A fallback may continue ordinary review work, but cannot satisfy a hard cross-agent gate.
- Valid model prose with missing or malformed coordinator output is a failed route, not a passing review.
- Reviewer credentials are selected by vendor; unrelated author-vendor secrets are omitted from the child environment.
- Cursor is intentionally absent from the selection matrix until its preferred external vendor is separately decided.

## Reuse boundary

Existing scenarios remain authoritative for fresh-context review enforcement, content-bound stamps, different-model comparison, synchronous headless invocation, neutral working directories, and CLI-specific cloud authentication. This feature's scenarios exercise the new coordinator contract and reference those rails through real collaborators; they do not duplicate the lower-level retro or gate examples.
