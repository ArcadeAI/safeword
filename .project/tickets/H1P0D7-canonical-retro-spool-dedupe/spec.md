# Spec: Keep cloud-spooled retro filing from bypassing duplicate checks

## Intent

The direct CLI filer already recognizes code-derived canonical markers, but the
cloud spool path can only recognize a legacy signature or guessed title. Carry
the canonical identity to the cloud filer so a recurrence lands on the same
issue regardless of transport.

## Intake Brief

- **Requested by:** alex, via GitHub issue #1031.
- **Cost of inaction:** cloud sessions can create duplicate retro issues for
  findings that direct CLI triage correctly recognizes as recurrences.
- **Reversibility:** two-way door; the optional JSONL field and prompt contract
  can be removed without migrating stored spool lines.

## References

- #1032 shipped the direct CLI canonical marker and lookup contract.
- #1031 owns parity for the cloud-spooled agent path.
- [GitHub issue/PR filtering](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests): exact candidate searches must use `is:issue`.
- [JSON Lines](https://jsonlines.org/): independently valid records permit a
  backwards-compatible optional field.

## Personas

- **Safeword Maintainer (SWM)** — owns the retro tracker and needs every runtime
  to recognize the same recurrence.

## Surfaces

Affected:

- Claude Code on the Web — the cloud agent path reads and files the spool.
- OpenAI Codex Cloud — its packaged `retro-filer` skill follows the same spool
  contract when the trusted Stop continuation directs it to file a spool.

Unaffected:

- Safeword CLI — direct CLI triage already has canonical lookup via #1032.

## Vocabulary

- **Canonical marker:** the exact hidden marker assembled by code from a
  canonical signature. It is a merge authority, not natural-language content.
- **Legacy marker:** the existing exact signature marker used by older drafts.

## Jobs To Be Done

### canonical-retro-spool-dedupe.SWM1 — Keep recurrences on one tracker issue

**Persona:** Safeword Maintainer (SWM)

> When a cloud session files a retro finding already known to direct CLI triage,
> I want it to find the same exact canonical issue, so the friction tracker has
> one trustworthy recurrence history instead of duplicates.

#### canonical-retro-spool-dedupe.SWM1.R1 — New cloud spool records retain the code-owned canonical identity

#### canonical-retro-spool-dedupe.SWM1.R2 — Cloud filing uses a canonical identity only when it agrees with the code-owned body marker

#### canonical-retro-spool-dedupe.SWM1.R3 — Cloud filing uses exact legacy-first canonical matching without title guesses across its runtime-specific carriers

#### canonical-retro-spool-dedupe.SWM1.R4 — Older spool records remain fileable through legacy signature matching

## Rave Moment

skip: internal consistency fix; no persona-facing moment beyond correct tracker accounting.

## Outcomes

- A current spool line round-trips the canonical signature, while an old line
  without it still parses unchanged.
- The cloud filer checks the exact legacy marker first, then the exact canonical
  marker when supplied, and comments on a match rather than filing anew.
- The filer never treats an exact title as a duplicate authority.
- The Claude/Cursor filing carriers and Codex plugin filer skill prescribe the
  same ordered contract, despite their different runtime mechanisms.

## Open Questions

- defer: GitHub API timeout and 5xx retry semantics belong to the filing
  transport's reliability work, not this exact-dedupe parity issue.
