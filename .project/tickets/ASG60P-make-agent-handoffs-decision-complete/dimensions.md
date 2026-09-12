# Dimensions: Make agent handoffs decision-complete in real replies

The proof varies by handoff intent, semantic completeness, transcript context,
host boundary, and delivery copy. Scenarios cover each behaviorally distinct
partition without expanding parser corruption cases already covered by the
existing Markdown scanner tests.

| Dimension | Partitions and boundaries | Why it changes behavior |
| --- | --- | --- |
| Handoff intent | decision in `Next`; blocked decision in `Need`; no-decision action; short conversation | Decision forms need a complete choice brief; actions stay short; ordinary chat stays untemplated |
| Decision completeness | all roles present; one or more roles missing; role stated only in earlier prose; necessary jargon unexplained | The terminal paragraph must stand alone semantically, not merely match Markdown labels |
| Action completeness | imperative action plus specific object; optional `Required because` clause; missing object; extra explanation; decision form paired with `Open: none` | Concision must not become syntactically vague or ceremonial |
| Transcript context | isolated brief; long-form response with decisive context earlier; observed Claude failure; observed Codex failure | Long replies expose dependence on prose outside the terminal paragraph |
| Host surface | Claude Code; OpenAI Codex; Cursor | Each host exposes a different Stop payload and continuation shape |
| Terminal correction state | first incomplete stop; compliant stop; correction-induced stop | The mechanism must correct once, pass compliant output, and avoid loops |
| Contract delivery | canonical; generated Claude; generated Codex; Cursor; dogfood installed copy; mismatched version | Presence is insufficient, but every consumer must receive the same versioned contract |
| Proof depth | pure evaluator; transcript corpus; native hook/process boundary | A unit-only claim can pass while host wiring is broken |

Boundary values: an empty or missing terminal paragraph is structurally invalid;
a one-clause `Need` is semantically incomplete; the smallest valid no-decision
handoff is one concrete action; a second correction attempt is suppressed.
