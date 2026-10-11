# Native review loop reuse

The second native consumer is the Product Plan intake gate. Reuse the existing
fixed Sol coordinator / Sonnet judge loop rather than copy another harness.
Only review kind, recorded phase and installed dispatch callback vary. The
original Implementation Plan bindings retain their exact verdict, provenance,
stamp, hook and unchanged-byte checks. Original host configuration is still
captured before Cucumber's profile sandbox and restored only for real callers.

The extraction is characterized by the two actual R12 examples. The negative
passes in /tmp/4200-native-loop-extraction.json (one scenario, 60 steps) and
requires a judged missing boundary, authenticated changes_requested refusal
and installed hook denial. The positive passes separately in
/tmp/4200-native-loop-positive.json (one scenario, 61 steps), preserving its
existing dispatch-only limit. Reporter totals include global cleanup hooks.
Three real reviews and judges run per example, with one known-bad control.

Independent source review 637809ab-3068-4fa0-a9da-6d92b1a5e4cf approves.
Nonblocking limits remain: the R12 positive is dispatch-only; older defect
fixtures state their defects explicitly; the per-step timeout may fail on slow
providers; malformed CLI JSON has limited diagnostics; the known-bad control
is a sanity check rather than complete judge qualification. None justifies
changing unrelated assertions or widening production scope in this extraction.

This is behavior-preserving test-support reuse, not production RED evidence or
whole-head review. The broader epic acceptance and ledger work remains open.
