# Dimensions: Prevent public CLI contracts from drifting again

| Dimension | Partitions and boundaries |
| --- | --- |
| Classification | public / retained-alias / internal; missing; duplicate; unsupported; public / hidden visibility mismatch |
| Registration | canonical; nested family; Commander alias; internal route; bare default; argv rewrite; registered only; catalogued only; renamed alias |
| Factory boundary | assembly only; argv normalization; parsing; handler invocation; process output and exit status |
| Syntax and options | route syntax and positional arity; long/short flag; parsed attribute; required/optional/variadic option value; negation; default; choices; hidden; global/local; conflicts/implies |
| Alias ownership | consumed local option; supported global option; delimiter value; explicit redundant option; unknown or inherited irrelevant option |
| Shipped proof | public command fixtures; rewrite fixtures; help; capabilities; Claude plugin; command reference; exact exit/stdout/stderr/schema; timeout; stable failure aggregation |
| Terminology | operative text; matched compatibility region; unmatched/reversed/nested delimiters; explicit file inventory |
| CI | every pull request; no paths filter; exact context; five-minute timeout; under-90-second target; no retry; staged duplicate check |
| Ruleset | exact observed context; active required check; strict current main; ordinary bypass absent; explicit administrative bypass |

Boundary emphasis: zero/one/multiple matches; one-character alias loss; one normalized option field changed at a time; one versus multiple stale surfaces; 90 seconds, two minutes, and five minutes.
