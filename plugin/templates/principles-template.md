# Principles

<!--
Project-wide principles that shape product, architecture, and delivery
decisions. Keep this set small and durable. A principle earns its place when it
changes a choice across multiple pieces of work; tactical recipes belong in
guides or patterns instead.

FORMAT

A principle is a `##` heading and a paragraph. Nothing else is required.

- The heading names the principle and is what work cites, so write it to be
  retyped exactly: short, stated positively, and with no `|` character (the
  citation lives in a Markdown table cell).
- Prefer an unnumbered heading. A number becomes part of the name, so
  `## 3. Ship reversible changes` must be cited with the `3.` included.
- The paragraph explains the principle. Saying what proof would count is the
  most useful sentence you can add, and is never required.
- `## Further reading` ends the list — put links and supporting sections after
  it.

Work does not copy this catalogue into tickets. Agents load it as project
knowledge, record only applicable principles, and name the concrete consequence
and proof. A deliberate conflict goes in the work's Known deviations and must
name the principle exactly as it appears here.

EXAMPLES (uncomment, customize, then delete this comment)

## Keep customer PII out of logs

Redaction happens before anything reaches a log, trace, or error report. Proof
usually looks like a redaction unit test plus one check of the real log sink.

## Ship changes that can be reverted in one command

Big-bang releases have burned us twice. Prefer feature flags and migrations with
a clean down path; no schema change ships without one.

## Adopt and extend OSS before building bespoke

Spend project effort on differentiated behavior instead of rebuilding mature
ecosystem capabilities. Adopt, configure, and wrap through public extension
points before implementing locally; avoid permanent forks and copied upstream
source. Proof is the candidate survey, the chosen extension boundary, and the
conditions that would trigger a reassessment.
-->
