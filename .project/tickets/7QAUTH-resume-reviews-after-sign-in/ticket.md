---
id: 7QAUTH
title: Resume independent reviews after sign-in
type: feature
status: in_progress
phase: implement
scope:
  - Confirm login completion in the assigned credential profile
  - Resume one unchanged signed review and link its retry
  - Keep status observational and stop abandoned work
done_when:
  - Both reviewer CLIs resume after confirmed sign-in without another message
  - Failed or abandoned sign-in never resumes
  - Login success with a failed assigned-profile authentication check never dispatches
  - Changed sources, policy, or receipts never dispatch
  - Duplicate completion creates at most one attempt
  - Original status follows the retry without side effects
out_of_scope:
  - Restart recovery
  - Author conversation wake-up guarantees
  - Changing reviewer routes or widening permissions
---

User approved implementation of the researched server-owned continuation. Preserve signed receipts and read-only status. Human sign-in remains required; saying “retry” does not.
