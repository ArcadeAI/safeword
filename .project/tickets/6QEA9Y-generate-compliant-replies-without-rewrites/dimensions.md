# Behavioral Dimensions: Generate compliant replies without correction loops

| Dimension | Partitions and boundaries |
| --- | --- |
| Session boundary | startup; resume; clear; compaction; fork |
| Terminal verdict | CONFIDENT; BLOCKED; missing; incomplete; duplicated verdict; duplicated paragraph label; mixed; incidental mention |
| Terminal block location | contiguous final Markdown block of top-level rendered paragraphs; blockquote; list item; fenced or indented code; HTML block or comment; prose mention; required labels outside the final block; trailing prose |
| CONFIDENT paragraphs | Decided + optional Rejected + Open + terminal Next in exact order; any required paragraph missing, reordered, or empty |
| BLOCKED paragraphs | Tried + terminal Need in exact order; separate Next absent; either paragraph missing, reordered, or empty |
| Line endings and size | LF; CRLF; ordinary reply; one/two/four-megabyte linear-work series; fixed four-megabyte reference-runner benchmark |
| Stop iteration | first Stop; correction Stop with `stop_hook_active` |
| Work mode | ordinary substantive update; active RED; active GREEN; active REFACTOR |
| Hard gate precedence | dependency; test; phase artifact; architecture review; done — first Stop and correction Stop |
| Advisory precedence | first-Stop incremental typecheck before format pass-through; correction Stop loop guard before advisory and format review |
| Contract composition | phase-neutral terminal grammar; phase-specific evidence appended only at Stop |
| Delivery boundary | configured SessionStart hook group with exact-once additive context; configured Stop subprocess; installed hook reconciliation; packaged Claude plugin inventory; dogfood template parity |
| Surface | Claude Code; Claude Code Cloud; Safeword CLI |

Terminal-block policy: normalize CRLF and qualify only top-level rendered
paragraphs. Ignore exact labels inside blockquotes, list items, fenced or
indented code, and HTML blocks or comments, then scan for one qualifying
terminal verdict block.
The block starts at an exact non-empty verdict paragraph, contains the exact
ordered non-empty paragraphs for that verdict, and ends at terminal Next or
Need with no trailing prose. Another qualifying verdict header makes the reply
invalid. Evaluation is a bounded line scan, not nested or overlapping regular
expressions.

Ignored-container policy: excluded Markdown containers neither create a valid
brief on their own nor invalidate a later valid top-level terminal brief.
Optional Rejected is legal only between Decided and Open.

Precedence policy: hard gates run on both first and correction Stops. On a first
Stop, typecheck advice precedes terminal-format pass-through. On a correction
Stop, `stop_hook_active` allows Stop after hard gates and before both advisory
typecheck and soft format review, preventing another continuation.
