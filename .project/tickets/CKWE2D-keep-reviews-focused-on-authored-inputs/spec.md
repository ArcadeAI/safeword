# Spec: Keep reviews focused on authored changes

<!-- safeword:inspiration-contract:v1 -->

## Intent

Independent reviews should remain bounded without making a builder manually
remove deterministic generated output from every review command. The command
must make its reduced scope explicit so a successful review is never mistaken
for inspection of every supplied target.

## Intake Brief

- **Requested by:** Safeword Maintainer through retro issue #2121.
- **Cost of inaction:** A normal changed-file review fails when generated runtime output exceeds the packet limit, forcing repeated, error-prone manual curation before independent review can begin.
- **Reversibility:** Two-way door — this changes local review input selection and result reporting without a public data migration or external API.

## References

- [Issue #2121](https://github.com/ArcadeAI/safeword/issues/2121) — original field report.
- [DR6M6N](../DR6M6N-reliable-reviews-for-real-packets/ticket.md) — the completed bounded-packet and review-routing contract; this ticket preserves its limits.
- [Git attributes documentation](https://git-scm.com/docs/gitattributes) — repositories can apply explicit, path-scoped attributes with well-defined precedence.
- [GitHub generated-file documentation](https://docs.github.com/en/repositories/working-with-files/managing-files/customizing-how-changed-files-appear-on-github) — `linguist-generated` is the explicit repository signal for generated output.
- [GitHub pull-request review guidance](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request) — review remains file-accountable, so excluded paths must stay visible.

## Personas

- Technical Builder (TBU)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Safeword CLI — owns review-packet construction and the machine-readable result.
- Claude Code — invokes the independent-review workflow.
- OpenAI Codex — invokes the independent-review workflow.

Unaffected:

- Cursor — it consumes the same CLI contract but has no host-specific code path in this change.

## Vocabulary

- **Generated target:** A supplied review target whose valid Git attribute
  record has the literal lower-case text `true` for `linguist-generated` in
  the repository's current `HEAD` tree. The lookup uses isolated, empty Git
  metadata, so working-tree attribute edits, project `.git/info/attributes`,
  global attributes, and system attributes do not participate. Git's unset, false,
  set-without-value, and other valid values are not generated exceptions;
  missing, duplicate, or malformed records are a lookup failure.
- **Canonical target path:** The lexical, normalized project-relative path
  obtained from a supplied target before any filesystem operation. This one
  identity is used for containment, validation, capture, Git lookup,
  deduplication, reviewer packet paths, and reporting. Distinct hard links
  remain distinct target paths; only duplicate lexical paths and lexical
  aliases collapse.
- **Reduced scope:** The eligible targets actually presented to a reviewer after explicitly generated oversized targets are omitted.
- **Individual packet limit:** At most 262144 bytes of a target's raw file
  contents. The existing 1048576-byte aggregate limit likewise measures the
  raw contents of all eligible targets, not packet framing.

## Product Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |
| --- | --- | --- | --- | --- | --- | --- |
| [GitHub generated-file handling](https://docs.github.com/en/repositories/working-with-files/managing-files/customizing-how-changed-files-appear-on-github) | 2026-08-12 | current documentation | generated paths are an explicit repository-owned classification and are hidden by default rather than silently treated as authored source | use an explicit source-of-truth marker and make the review scope visible | do not copy GitHub's UI behavior or broad language heuristics | retain hard packet limits but allow only explicit generated targets to be omitted and report them |

## Jobs To Be Done

### focused-review.TBU1 — Start an independent review without hand-curating generated output

**Persona:** Technical Builder (TBU)

> When my change includes a large deterministic generated artifact, I want the
> review command to focus on the authored inputs and show what it left out, so
> I can start a useful independent review without concealing its limits.

#### focused-review.TBU1.R1 — An explicitly generated oversized target is excluded only from the reviewer packet and remains visible in the result

#### focused-review.TBU1.R2 — An oversized target without an explicit generated marker still prevents the review from running

### focused-review.SWM1 — Keep generated-review policy deterministic and auditable

**Persona:** Safeword Maintainer (SWM)

> When I maintain generated plugin outputs, I want their generated status to be
> declared in repository metadata and exercised by dogfood tests, so review
> behavior is stable and does not depend on filename guesses.

#### focused-review.SWM1.R1 — A review with no eligible targets reports that condition rather than asking a reviewer to approve an empty packet

#### focused-review.SWM1.R2 — Safeword's own generated runtime outputs use the same repository marker the command reads

## Rave Moment

skip: internal CLI behavior; transparent bounded review is table stakes rather than a shareable moment.

## Outcomes

- A review with an explicit generated oversized target reaches its independent reviewer with every eligible authored target.
- The successful machine-readable result exposes `excluded_targets` as the
  exact, duplicate-free project-relative paths it omitted, in supplied-target
  order. Any route outcome after packet scope is finalized carries the same
  field; a failed preflight never emits it.
- A caller receives a distinct machine-readable failure before reviewer launch
  when an oversized target is unmarked or when every supplied target was
  excluded, including a nonzero command result with the relevant error code.
- A Git attribute command failure or malformed record is a distinct preflight
  failure (`REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE`), never silently reclassified
  as an unmarked target; valid non-true attribute values remain unmarked.
- A Git attribute lookup has a bounded execution time and captured output. A
  timeout or output-limit breach is the same closed
  `REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE` preflight failure.
- Preflight reads at most the existing individual packet limit from any
  eligible target. It validates regular-file and containment invariants for
  every target before classification, but uses metadata rather than reading or
  decoding an oversized target that may be omitted. Eligible content snapshots
  remain UTF-8 validated and are checked for source drift before attribute
  lookup and reviewer launch; a drift is a preflight failure with no finalized
  reduced scope.
- An oversized candidate is revalidated after attribute lookup and before its
  exclusion becomes final. A replacement, type change, or newly escaping path
  fails closed before reviewer launch without ever reading the candidate bytes.
- Generated classification evaluates the immutable committed Git tree. A
  working-tree attribute rewrite cannot alter an in-progress review or create
  an omission before its marker is committed.
- A generated classification record must be exactly one well-formed record for
  the canonical target path; a missing, duplicate, mismatched, or extra record
  is malformed rather than permission to omit anything. The record is exactly
  three UTF-8 NUL-terminated fields in order: canonical path,
  `linguist-generated`, and value, with no trailing bytes.
- Preflight evaluates every target before deciding its result. If an oversized
  unmarked target and an attribute-resolution failure coexist,
  `REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE` wins regardless of supplied order.
  Otherwise, every target is still evaluated and the first supplied normalized
  target with a failure supplies the deterministic error code.
- A valid, contained oversized target is classified even when an earlier target
  has another failure; a target that fails containment or regular-file
  validation is never sent to Git attribute lookup.
- Duplicate and lexical-alias review targets collapse before packet capture,
  aggregate accounting, classification, and result reporting. Containment
  applies after full lexical normalization.
- Eligible canonical paths retain first-supplied order in the reviewer packet;
  generated omissions do not reorder the remaining eligible paths.
- The repository explicitly marks its generated plugin runtime output, and a regression proves the marker is honored.

## Open Questions

None. Safeword already uses the marker in `.gitattributes`; the implementation
must apply the same explicit committed-tree meaning to its generated runtime
outputs without inheriting local Git overrides.
