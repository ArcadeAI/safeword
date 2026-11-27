# Help discovery without a sitemap

The task freezes BDD Extractor at `31e36896c4fce6bd2ec7df775238aa82de0f1ecc`
before the initial one-level discovery change. The agent gets the feature
request and the sanitized repository. The hidden verifier calls
`harvestUrls`, the production discovery entry point, against an actual
loopback HTTP site. It checks article discovery, the crawl and scope
boundary, and precedence of a usable sitemap separately.

## Decision log

If an agent asks how far to follow links, reply:

> If no usable sitemap exists, read the homepage and each in-scope page the homepage directly links to. Include the in-scope links they list, and stop discovery there. Keep sitemap precedence and the existing scope rules. Skip a linked page you can't read.

This records the historical feature decision. In future runs, accept routine
approvals within that scope and log them as scripted replies. Relay actual
decisions the record cannot answer.

## Docker calibration

| Implementation                                            | Finds article | Respects boundary | Preserves sitemap precedence | Pass |
| --------------------------------------------------------- | ------------: | ----------------: | ---------------------------: | ---: |
| Frozen original                                           |             0 |                 0 |                            1 |    0 |
| Historical feature `2816814`                              |             1 |                 1 |                            1 |    1 |
| Historical feature with an extra hop                      |             1 |                 0 |                            1 |    0 |
| Historical feature that ignores a sitemap                 |             1 |                 1 |                            0 |    0 |
| Historical feature that includes out-of-scope child links |             1 |                 0 |                            1 |    0 |

The original and each broken variant failed the intended check. The verifier
used local HTTP without external network access.

Harbor also ran the untouched starter with its no-op agent and the reference
with its oracle agent. Both completed and produced the expected rewards.
The reference solution was placed in a temporary oracle fixture outside the
comparison task.

- [Harbor no-op control](../jobs/extractor-discovery-nop-20261122T052149Z/result.json)
- [Harbor oracle control](../jobs/extractor-discovery-oracle-20261122T052113Z/result.json)

## Comparison status

The three-arm model run did not start. Both 1Password authorization attempts
timed out before Harbor received its credentials. The controls above are
grader evidence only.

A local-only subscription attempt was also prepared. The one-time Claude
browser authorization was incomplete when the runner's wait expired.
No model trial started, and no credential was retained by the runner.

### Completed subscription comparison

Retried manually on November 21, 2026 Pacific time. All three arms ran
one Haiku 4.5 attempt in isolated containers using Claude subscription
authentication. The stable release was 1.1.0 and the checkout was
`72165cde6`. Harbor kept the results local. No arm asked for input.

| Arm                 | Found the article | Respected the boundary | Preserved sitemap precedence | Passed |
| ------------------- | ----------------: | ---------------------: | ---------------------------: | -----: |
| No Safeword         |                 1 |                      1 |                            1 |      1 |
| Stable release      |                 0 |                      1 |                            1 |      0 |
| Unreleased checkout |                 0 |                      0 |                            1 |      0 |

The baseline submitted a passing patch. Its log reached the turn cap and
then recorded two further completions in the same session. I stopped an
orphaned test process in that trial container so Harbor could finish grading.
Treat its runtime and turn count as diagnostics. The stable release read
the topic, then scoped the article links against the topic URL instead of
the help root. The checkout reproduced the bug and stopped before editing
the implementation, with no request for user input.

- [No Safeword](../jobs/extractor-discovery-baseline-default-human-72165cde6-20261122T054352Z/result.json)
- [Stable release](../jobs/extractor-discovery-release-default-human-72165cde6-20261122T054352Z/result.json)
- [Unreleased checkout](../jobs/extractor-discovery-checkout-default-human-72165cde6-20261122T054352Z/result.json)

### Two additional attempts per arm

Two fresh attempts per arm used the same fixture, verifier, model, plugin
revisions, and local subscription authentication. Each arm ran one
container at a time. The same relay rules applied across arms. A message
with several questions counted as one checkpoint. The baseline and checkout
each received the recorded crawl boundary after asking about their proposed
approach. The checkout then asked for approval to implement, which was
relayed to the user.

Two checkout attempts, the original and the first repeat, ended on a normal
Claude `end_turn` with `Open: none`, no implementation change, and a coding
step listed under `Next`. The relay had no actual question to route in
either attempt. The pinned Stop hook checks the shape of a handoff and
applies stricter evidence gates to work marked done. The traces establish
where execution stopped. They leave open whether a specific handbook
instruction caused Claude to stop.

I terminated leftover test subprocesses in three repeat containers after
Claude had emitted a result, so Harbor could grade the saved work. Treat
those trials' durations and subsequent exit behavior as diagnostics.

| Arm                 | Passed both new attempts | Passed across all three | Input checkpoints in repeats | Replies delivered |
| ------------------- | -----------------------: | ----------------------: | ---------------------------: | ----------------: |
| No Safeword         |                      2/2 |                     3/3 |                            1 |                 1 |
| Stable release      |                      2/2 |                     2/3 |                            0 |                 0 |
| Unreleased checkout |                      0/2 |                     0/3 |                            2 |                 1 |

The final checkout attempt timed out while waiting for the relayed approval.
Its previous reply covered the crawl question and had resumed the trial.
The stable release corrected the earlier scope bug in both repeats. One of
its passing patches was saved before a turn-limit exception.

- [No Safeword repeats](../jobs/extractor-discovery-baseline-default-human-72165cde6-20261122T064527Z/result.json)
- [Stable release repeats](../jobs/extractor-discovery-release-default-human-72165cde6-20261122T064527Z/result.json)
- [Unreleased checkout repeats](../jobs/extractor-discovery-checkout-default-human-72165cde6-20261122T064527Z/result.json)
- [Repeat relay records](../jobs/discovery-repeat-relay-20261122T064426Z)

### Three fresh checkout attempts with scripted approval

The three attempts used the same fixture, verifier, checkout, and local
Claude subscription. Each ran in its own container. The reply policy used
the recorded crawl boundary for scope questions and accepted routine
approvals within that scope. The baseline and release retained their
results from the prior comparison.

| Attempt   | Discovery | Crawl boundary | Sitemap precedence | Pass | Outcome                                               |
| --------- | --------: | -------------: | -----------------: | ---: | ----------------------------------------------------- |
| `77qwnQz` |         0 |              0 |                  1 |    0 | Ended before implementation                           |
| `Y3gQKS5` |         0 |              0 |                  1 |    0 | Got the scope reply and ended after presenting a plan |
| `2FKARuK` |         0 |              1 |                  1 |    0 | Saved a partial patch and reached the agent timeout   |

Two scope questions were answered from the decision log. Two other relay
checkpoints were handoffs without a question and received no reply. The
agents asked for zero routine approvals in this batch.

Both early stops were normal Claude `end_turn` results with work listed
under `Next`. The relay ends the trial on a null reply, and it sent one
for each handoff because there was no question. That explains why neither
session resumed. The traces do not explain why Claude chose to yield or
establish that a Safeword hook forced either stop.

The third agent's test explicitly required topic pages to be excluded
from the returned list. Its patch implemented that expectation, dropping
the homepage's existing links when it found deeper links. Harbor checked
that discovery adds articles while preserving existing results. It graded
the saved patch in under one second after the agent reached its 20-minute
limit.

The HTTP 429 messages in the transcript came from simulated refusals in
the existing extractor tests. The fixtures inject responses and use a
fake clock. The agent repeatedly ran the full test script and launched
polling commands that looked for specific output text and missed process
termination. I terminated two of those polling commands after the tests
they were watching had exited. The traces do not establish the exact
fraction of the timeout spent in the suite versus its wrappers.

- [Checkout job results](../jobs/extractor-discovery-checkout-default-human-72165cde6-20261122T215422Z/result.json)
- [Partial patch verifier output](../jobs/extractor-discovery-checkout-default-human-72165cde6-20261122T215422Z/extractor-discovery__2FKARuK/verifier/test-stdout.txt)
- [Scripted relay records](../jobs/discovery-approved-relay-20261122T215422Z)

### Nine fresh attempts with explicit relay actions

All three arms ran three fresh attempts with the same Haiku model, fixture,
hidden grader, and local subscription authentication. This batch held the
plugin revisions from the prior comparison fixed to isolate the protocol
change. Each arm ran three trials in parallel, in separate containers.
Harbor allowed 20 minutes per trial, and each Claude invocation received
the 50-turn and USD 1.00 limits.

| Arm                    | Passed | Discovery | Crawl boundary | Sitemap precedence | Scripted scope replies | Generic continues | Human replies |
| ---------------------- | -----: | --------: | -------------: | -----------------: | ---------------------: | ----------------: | ------------: |
| No Safeword            |    1/3 |       1/3 |            2/3 |                3/3 |                      0 |                 0 |             0 |
| Release 1.1.0          |    1/3 |       1/3 |            3/3 |                3/3 |                      0 |                 0 |             0 |
| Unreleased `72165cde6` |    2/3 |       2/3 |            3/3 |                3/3 |                      2 |                 0 |             0 |

The two passing checkout trials asked how far to crawl and received the
same recorded answer. The remaining checkout trial reached the Claude
turn limit. Harbor still graded its saved patch, which missed the deeper
article. All five failures in this batch missed the article. No trial
used the new generic continuation action. The saved handoff replays
exercised that action and the two-use cap. This batch leaves the effect
of generic continuation on live pass rates unmeasured.

I terminated leftover test processes in one baseline and one release
container after Claude emitted a result. Their saved patches passed.
Treat affected test and runtime traces as diagnostic.

- [No Safeword results](../jobs/extractor-discovery-baseline-default-human-72165cde6-20261123T044954Z/result.json)
- [Release results](../jobs/extractor-discovery-release-default-human-72165cde6-20261123T045749Z/result.json)
- [Unreleased results](../jobs/extractor-discovery-checkout-default-human-72165cde6-20261123T051152Z/result.json)
- [Relay records](../jobs/discovery-explicit-relay-20261123T044954Z)
