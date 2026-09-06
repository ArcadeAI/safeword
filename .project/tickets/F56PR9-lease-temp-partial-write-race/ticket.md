---
id: F56PR9
slug: lease-temp-partial-write-race
type: patch
phase: intake
status: backlog
created: 2026-09-06T00:08:01.639Z
last_modified: 2026-09-06T00:08:01.639Z
scope: |
  All four Stop hooks failed closed on 2026-09-05 with "Safeword Claude plugin
  contains an unlisted asset: .in_use/31268.tmp.b3cdbfa3". PID 31268 was a live
  Claude process and the file was gone by the time it was inspected, so this was
  a race against Claude's own lease write, not cache tampering.

  `isClaudeLeaseMarker` in src/claude-plugin/inventory.ts accepts a `<pid>.tmp.<hex>`
  lease that is unreadable and has since vanished (#3690). Claude creates that
  temp file *before* writing its bytes, so there is a second window the fix did
  not cover: the file is present and readable with empty or half-written content.
  `JSON.parse` throws, the catch returns false, and the whole plugin fails closed.

  Decide whether a present-but-unparseable temp lease should re-check
  `vanishedDuringScan` before being rejected, and if so land that with a test.
out_of_scope: |
  - Widening acceptance for the final `<pid>` lease name. Only a temp name is
    mid-rename; #3690's infix guard is deliberate and has a mutant-killing test.
  - Blanket-skipping `.in_use/`. The narrow shape check is what keeps this from
    concealing a payload file.
done_when: |
  - The production reject path is reproduced in a test before anything changes —
    the first attempt at this failed to reproduce and must not be repeated.
  - Stop hooks survive a lease temp caught mid-write.
  - The mutant-killing coverage from #3690 still passes unchanged.
---

# Stop hooks failing when Claude is mid-write on its own cache lease

**Goal:** Safeword's plugin integrity check tolerates a lease temp file caught between creation and its content write

**Why:** Every Stop hook failed closed today on .in_use/31268.tmp.b3cdbfa3, the same class of failure as #3690

## Work Log

- 2026-09-06T00:08:01.639Z Started: Created ticket F56PR9
