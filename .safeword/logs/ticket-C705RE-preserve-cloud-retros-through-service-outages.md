# Work Log: Preserve cloud retros through service outages

**Anchored to:** `.project/tickets/C705RE-preserve-cloud-retros-through-service-outages/ticket.md`

---

## Session: 2026-08-08

- [06:53] Created the feature ticket through the local Safe Word CLI.
- [06:54] Read the relay foundation, installed surface adapters, and project
  surface map. Local lifecycle hooks cannot stand in for all cloud carriers.
- [06:55] Proposed a durable-intake boundary: receipt before cloud completion,
  worker/track-outage recovery after receipt, and visible incompletion without
  one. Waiting for the BDD JTBD gate to confirm the unavoidable total-outage
  boundary before writing Rules or engineering scope.
- [07:00] Quality review: independent Claude approved the intake (dispatch
  `84931b07-8bce-4bee-bd51-4a629b0a9b13`). Current Claude documentation
  confirms repository/managed hooks run in cloud sessions; current Codex cloud
  documentation confirms a container setup phase and that task secrets are
  removed before the agent phase. Added a host-managed credential JTBD and an
  NTB outcome; carrier mapping and machine-readable scope remain for the next
  BDD gates.
- [07:05] User selected the receipt boundary over provider-specific durable
  storage. Replaced the open question with the explicit decision and added
  testable Rules under each JTBD; waiting for the Rules gate.
- [07:10] User clarified that the feature must feel invisible. Revised the
  proposal to quiet bounded best effort: no builder-facing interruption on a
  missing receipt, sanitized operational evidence only, and no claim that this
  activates #1479's all-harness/no-loss route.
