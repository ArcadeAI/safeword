---
generator: safeword-architecture
fingerprint: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd
---

# Architecture

## Modules

### build-preservation-variant

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`build-preservation-variant.py`

<!-- seeded-purpose: 5d450fcace6c32c2d20613d3affebe1fb96a18e84185db4f0676062193571916 -->

Build a fixture-only Claude plugin variant from a committed Safeword revision.

### comparison_agent

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`comparison_agent.py`

No description yet — awaiting prose.

### completion_feedback

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`completion_feedback.py`

No description yet — awaiting prose.

### fixture_grader

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`fixture_grader.py`

<!-- seeded-purpose: ccf49a50a423b1d4d8d8870dc34adc5f567444d5ae4e88396191ad8587b4ed31 -->

Shared hidden functional and preservation checks for generated JavaScript tasks.

### grade_workflow

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`grade_workflow.py`

<!-- seeded-purpose: 4aebe0c5d7f67de2f7d21b6e0b93ba39c386b4f99a5283ee681c0367f9b6fcb7 -->

Grade Safeword feature milestones from a completed Claude Harbor trace.

### human_relay

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`human_relay.py`

<!-- seeded-purpose: 030c3c885c79ee8e67f3d6320cea1c804a4307a164b19e04bc093a3d28231c89 -->

Host-side relay for Claude's turn-ending messages in a Harbor trial.

### intake_cutoff

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`intake_cutoff.py`

<!-- seeded-purpose: fb71fad5d58165e3dc0deb42e6b4019ffdc92d9a0b82d606e77054ba4bee3e09 -->

Stop a Harbor author at the observed boundary of feature intake.

### model_spend

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`model_spend.py`

<!-- seeded-purpose: 3cf54a32cb043a9b073b58854be93fc8d9c611e7dc81ba29cf7fc9eef5f1a394 -->

Report API-equivalent spend for the author and the reviewer processes.

### report_trials

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`report_trials.py`

<!-- seeded-purpose: 495f256436c9cde0bfd4a0d2c8c991cd72c2fac4df80bf1d21edd519e4bc5649 -->

Summarize Harbor traces and close drafts with an observed creation receipt.

### resolve_comparison

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`resolve_comparison.py`

<!-- seeded-purpose: f0bf0e91591da7e4bf08e8ace6f6460ebb46c28e49cdf14b59208561448372c7 -->

Resolve signed-in models and freeze their rates for one Harbor comparison.

### test_fixture_graders

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`test_fixture_graders.py`

No description yet — awaiting prose.

### test_human_relay

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`test_human_relay.py`

No description yet — awaiting prose.

### test_intake_cutoff

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`test_intake_cutoff.py`

No description yet — awaiting prose.

### test_launchers

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`test_launchers.py`

No description yet — awaiting prose.

### test_model_spend

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`test_model_spend.py`

No description yet — awaiting prose.

### test_trace_events

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`test_trace_events.py`

No description yet — awaiting prose.

### test_trial_evidence

<!-- reconciled: 38c80b611748e1a267482c3d7477589c73a676fdbdd43bd9e72490a2c5a682cd -->

`test_trial_evidence.py`

No description yet — awaiting prose.
