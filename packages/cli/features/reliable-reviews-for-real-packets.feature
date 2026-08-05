Feature: Keep independent reviews reliable for real ticket packets

  Cross-agent review must survive realistic bounded packets, tell the fallback
  reviewer exactly what a valid answer looks like, keep one genuinely
  independent attempt in reserve, and explain an exhausted route plainly.

  @reliable-reviews-for-real-packets.TBU1.R1 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU1.R1 — Every review attempt gets the same documented deadline, set well above the slowest review anyone has observed

    Scenario: A representative ticket-sized review is given time to finish
      Given a five-file review packet of about 58 KB
      And the assigned reviewer answers after 111 seconds
      When the independent review runs
      Then the review returns the reviewer's verdict

    Scenario Outline: Every attempt gets the same deadline whatever the packet holds
      Given a review packet of <size>
      When the attempt deadline is derived
      Then the deadline is 300 seconds

      Examples:
        | size                                     |
        | a single small file                      |
        | five files of about 58 KB                |
        | 1 MiB, the largest packet accepted       |

    @rejection
    Scenario: A packet over the accepted maximum is refused rather than budgeted
      Given a packet whose file contents total one byte over the accepted 1 MiB limit
      When the independent review runs
      Then the packet is refused
      And no candidate is asked what it supports
      And no reviewer process is started at all

    Scenario Outline: The attempt deadline is decided on a controlled clock
      Given a reviewer whose answer arrives <timing> its attempt budget
      When the independent review runs
      Then the review <outcome>

      Examples:
        | timing                | outcome                     |
        | one tick before       | returns the reviewer verdict|
        | exactly at            | returns the reviewer verdict|

    Scenario Outline: An answer already complete when the deadline fires wins the tie
      Given a reviewer whose answer and its attempt deadline fall on the same instant
      And the <first> event is handled first
      When the independent review runs
      Then the review returns the reviewer's verdict

      Examples:
        | first    |
        | answer   |
        | deadline |

    @rejection
    Scenario: A reviewer answering one tick past its budget is refused
      Given a reviewer whose answer arrives one tick after its attempt budget
      When the independent review runs
      Then the review is reported as timed out

  @reliable-reviews-for-real-packets.TBU1.R2 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU1.R2 — A reviewer that never finishes is still stopped at its deadline and reported as a timeout

    @rejection
    Scenario: A reviewer that never answers is stopped when its budget expires
      Given an assigned reviewer that never produces an answer
      And no later route can complete either
      When the independent review runs
      Then that reviewer is asked to stop the moment its attempt budget expires
      And it is no longer running once the cleanup budget has passed
      And the assigned reviewer route is reported as timed out

    Scenario: An explicitly configured deadline replaces the default
      Given an explicitly configured attempt deadline of 2 minutes
      When the attempt deadline is derived
      Then the deadline is 2 minutes

    Scenario Outline: A configured deadline is honoured only up to the run bound
      Given an explicitly configured attempt deadline of <configured>
      When the attempt deadline is derived
      Then the deadline is <effective>

      Examples:
        | configured        | effective   |
        | 240 seconds       | 240 seconds |
        | 300 seconds       | 300 seconds |
        | 540 seconds       | 540 seconds |
        | 600 seconds       | 540 seconds |

    @rejection
    Scenario Outline: A meaningless configured budget is ignored
      Given an explicitly configured attempt deadline of <budget>
      When the attempt budget is derived
      Then the default deadline is used instead of the configured one

      Examples:
        | budget           |
        | zero             |
        | a negative time  |
        | not a number     |
        | an infinite time |
        | a blank value    |
        | "90s"            |

  @reliable-reviews-for-real-packets.TBU1.R3 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU1.R3 — A route's budget is split across its untried candidates, so one slow or stale executable cannot consume every other candidate's opportunity

    Scenario: A slow first reviewer executable still leaves the next one a chance
      Given two installed reviewer executables that both accept the review contract
      And the first executable never answers
      And the second executable answers promptly
      When the independent review runs
      Then the review returns the second executable's verdict

    Scenario: A hanging candidate is stopped at its own share of the route budget
      Given a route with a 300-second attempt budget
      And two installed reviewer executables that both accept the review contract
      And each capability question takes 5 seconds to answer
      And the first executable never answers
      When the independent review runs
      Then the first executable is stopped 145 seconds after it is asked to review
      And the second executable is given the 145 seconds that remain after its own capability question

    Scenario: Three candidates each get a real turn
      Given three installed reviewer executables that all accept the review contract
      And only the last executable ever answers
      When the independent review runs
      Then the review returns the last executable's verdict

    Scenario: Each candidate's share is recalculated from what is left
      Given a route with a 300-second attempt budget
      And three installed reviewer executables that all accept the review contract
      And every capability question is answered instantly
      And the first executable never answers
      And the second executable fails the instant it is asked to review
      When the independent review runs
      Then each candidate is given this deadline for its own review attempt:
        | candidate | deadline after its own start |
        | first     | 100 seconds |
        | second    | 100 seconds |
        | third     | 200 seconds |

    Scenario Outline: A first reviewer executable failing any way still leaves the next one a chance
      Given two installed reviewer executables that both accept the review contract
      And the first executable <failure>
      And the second executable answers promptly
      When the independent review runs
      Then the review returns the second executable's verdict

      Examples:
        | failure                        |
        | never answers                  |
        | crashes before answering       |
        | cannot be launched at all      |
        | answers outside the contract   |

    @rejection
    Scenario: Every reviewer executable failing still reports a timeout
      Given two installed reviewer executables that both accept the review contract
      And neither executable ever answers
      And no later route can complete either
      When the independent review runs
      Then the assigned reviewer route is reported as timed out

  @reliable-reviews-for-real-packets.TBU1.R4 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU1.R4 — However a reviewer ends, Safe Word stops it and the descendants its platform lets it reach, never waits on what the system will not kill, never claims to have stopped what escaped, and never uses a late answer

    Scenario Outline: A reviewer stopped for any reason leaves nothing running
      Given a reviewer that starts a child process inside its own process group
      And that reviewer <ending>
      When the independent review runs
      Then neither the reviewer nor its child process is still running afterwards
      And nothing is left running when the next candidate starts

      Examples:
        | ending                                     |
        | answers well within its budget             |
        | answers while a child holds its output open|
        | never answers                              |
        | crashes before answering                   |
        | answers outside the contract               |

    Scenario: Cleanup reaches every descendant the platform groups with the reviewer
      Given a reviewer that never answers and leaves a grandchild grouped with it
      When the independent review runs
      Then no process grouped with that reviewer is still running afterwards

    @rejection
    Scenario: A descendant that escapes into its own session is not claimed to be stopped
      Given a reviewer that never answers and leaves a descendant in a new session
      When the independent review runs
      Then the reviewer's own process group is stopped
      And the review does not claim that descendant was stopped

    @rejection
    Scenario: A reviewer the system will not kill is abandoned, not waited on
      Given a reviewer whose processes cannot be stopped
      When the independent review runs
      Then the run stops waiting for cleanup after 5 seconds
      And the next route still starts
      And nothing that reviewer produces afterwards is used

    @rejection
    Scenario: A late answer after a timeout is ignored
      Given a reviewer that answers only after it was stopped for running out of time
      When the independent review runs
      Then the review is reported as timed out
      And the late answer is not used

  @reliable-reviews-for-real-packets.TBU2.R1 @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU2.R1 — A reviewer that supports typed output is given the exact result contract the check will enforce

    Scenario: The Codex reviewer is told the exact shape its answer must take
      Given an installed Codex reviewer that supports typed output
      When the independent review runs
      Then the Codex reviewer is given the review result contract

    Scenario: The contract handed out names exactly the fields the check enforces
      Given the review result contract handed to a reviewer
      When its required fields are listed
      Then they are exactly these, and no others are permitted:
        | field          |
        | schema_version |
        | dispatch_id    |
        | reviewer_agent |
        | verdict        |
        | summary        |
        | findings       |
      And each finding it describes requires exactly a severity and a message

    Scenario: The contract handed out pins every field's shape
      Given the review result contract handed to a reviewer
      When its shape is inspected
      Then each field is described exactly as:
        | field          | shape                                            |
        | schema_version | the number 1 and nothing else                    |
        | dispatch_id    | text that is not empty                           |
        | reviewer_agent | one of claude or codex                           |
        | verdict        | one of approve or request_changes                |
        | summary        | text that is not empty                           |
        | findings       | a list of findings, possibly empty               |
      And each finding is described exactly as a severity of info, warning or error, and a message that is text and not empty
      And no object anywhere in the contract permits an undeclared field

    Scenario Outline: The contract handed out permits exactly the severities the check accepts
      Given the review result contract handed to a reviewer
      When a finding of severity <severity> is checked
      Then the contract and the check agree that it is <accepted>

      Examples:
        | severity | accepted |
        | info     | accepted |
        | warning  | accepted |
        | error    | accepted |
        | high     | refused  |
        | medium   | refused  |
        | critical | refused  |

    Scenario: A Codex answer that follows the contract is accepted
      Given an installed Codex reviewer that answers in the review result contract
      When the independent review runs
      Then the review returns the Codex reviewer's verdict

    @rejection
    Scenario: A reviewer that cannot be given the contract is not asked to review
      Given an installed Codex reviewer that supports typed output
      And the review result contract cannot be handed to it
      When the independent review runs
      Then no review is requested from that reviewer

  @reliable-reviews-for-real-packets.TBU2.R2 @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU2.R2 — A reviewer executable that cannot honour the result contract never costs a later candidate its turn — skipped before launch when that is knowable, failed fast when it is not

    Scenario: A reviewer executable without typed output is skipped for one that has it
      Given an installed reviewer executable that cannot produce typed output
      And a second installed reviewer executable that can
      When the independent review runs
      Then the review returns the second executable's verdict

    Scenario Outline: A candidate that cannot honour the contract never costs the next one its turn
      Given a first installed reviewer executable that <problem>
      And a second installed reviewer executable that supports typed output
      When the independent review runs
      Then the review returns the second executable's verdict
      And the second executable's share is recalculated from the time that remains

      Examples:
        | problem                                      |
        | cannot be asked what it supports             |
        | answers the capability question unreadably   |
        | is too old a version to support typed output |
        | claims typed output but rejects it on launch |

    Scenario: A capability question that hangs is abandoned quickly
      Given a first installed reviewer executable that never answers the capability question
      And a second installed reviewer executable that supports typed output
      When the independent review runs
      Then the capability question is abandoned after 5 seconds
      And nothing from that executable is left running
      And the review returns the second executable's verdict

    @rejection
    Scenario: No reviewer executable supporting typed output means no reviewer is available
      Given every installed reviewer executable cannot produce typed output
      When the independent review runs
      Then the review reports that no compatible reviewer is installed

  @reliable-reviews-for-real-packets.TBU2.R3 @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU2.R3 — A result that violates the contract is still rejected, whatever produced it

    @rejection
    Scenario Outline: Any answer outside the contract is rejected
      Given a reviewer answer that <defect>
      When the answer is checked
      Then the answer is rejected as invalid reviewer output

      Examples:
        | defect                                        |
        | uses a severity the contract does not permit  |
        | carries a field the contract does not define  |
        | omits a required field                        |
        | gives a required field the wrong type         |
        | leaves its identifier, summary or a message empty |
        | is not readable as a result at all            |
        | carries an extra field inside a finding       |
        | uses a verdict the contract does not permit   |
        | declares a different contract version         |

    @rejection
    Scenario Outline: An answer that does not belong to this request is refused
      Given a reviewer answer that follows the contract
      But <mismatch>
      When the answer is checked
      Then the answer is refused and no verdict is recorded

      Examples:
        | mismatch                                          |
        | it carries a different review's identifier        |
        | it claims a reviewer other than the one asked     |
        | it claims no reviewer at all                      |

  @reliable-reviews-for-real-packets.TBU3.R1 @surface.claude-code @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU3.R1 — An exhausted reviewer agent is retried on a configured alternate model before the author's own runtime

    Scenario: An exhausted reviewer agent is retried on its alternate model
      Given a configured alternate model for the reviewer agent
      And the reviewer agent's default model never answers
      And the reviewer agent's alternate model answers promptly
      When the independent review runs
      Then the review returns the alternate model's verdict

    @rejection
    Scenario: An alternate model that also fails falls back to the author's own runtime
      Given a configured alternate model for the reviewer agent
      And neither the reviewer agent's default nor alternate model answers
      And the author's own runtime answers promptly
      When the independent review runs
      Then the review reports that the check was not independent

  @reliable-reviews-for-real-packets.TBU3.R2 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU3.R2 — A review completed by the reviewer agent on its alternate model is still a full cross-agent check, and the result names the model that actually reviewed

    Scenario: An alternate-model review still counts as a full independent check
      Given the reviewer agent's alternate model completed the review
      When the review result is reported
      Then the result reports a full cross-agent check
      And Safe Word's own result names the model it asked to review

    Scenario: Safe Word's own result reports routing in named fields
      Given the reviewer agent's alternate model completed the review
      When the review result is reported
      Then Safe Word's own result adds exactly these routing facts:
        | fact                | value                                     |
        | assigned_reviewer   | the reviewer agent that was asked         |
        | actual_reviewer     | the agent that produced the verdict       |
        | reviewer_model      | the model Safe Word asked it to use       |
        | independence        | cross-agent                               |
      And every routing fact the result already reported is still present
      And the reviewer's own answer is reported unchanged in its own place
      And nothing from the reviewer's answer can overwrite a routing fact

    @rejection
    Scenario: Naming the model never widens what a reviewer may answer
      Given the reviewer agent's alternate model completed the review
      When the reviewer's answer is checked
      Then the answer carries no model field
      And an answer that adds one is rejected

    Scenario: A required cross-agent check is satisfied by an alternate-model review
      Given a required cross-agent review policy
      And the reviewer agent's alternate model completed the review
      When the review result is reported
      Then the required cross-agent check is satisfied

    @rejection
    Scenario: An alternate model of the author's own runtime is not a cross-agent check
      Given the author's own runtime completed the review on an alternate model
      When the review result is reported
      Then the result does not report a full cross-agent check

  @reliable-reviews-for-real-packets.TBU3.R3 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU3.R3 — With no alternate model configured, routing is exactly what it is today, and Safe Word never supplies a model name of its own

    Scenario: No configured alternate model keeps today's routing
      Given no configured alternate model for the reviewer agent
      And the reviewer agent never answers
      And the author's own runtime answers promptly
      When the independent review runs
      Then the review reports that the check was not independent

    @rejection
    Scenario: Safe Word never chooses a model on the builder's behalf
      Given no configured alternate model for the reviewer agent
      When the independent review runs
      Then the reviewer is asked for a review without any model selection

    @rejection
    Scenario Outline: An unusable configured model is treated as none configured
      Given a configured alternate model for the reviewer agent of <value>
      And the reviewer agent's default model never answers
      When the independent review runs
      Then the reviewer is never asked for a review on an alternate model

      Examples:
        | value                        |
        | an empty value               |
        | " "                          |
        | a value carrying a newline   |
        | "sonnet; rm -rf /"           |
        | "sonnet$(whoami)"            |
        | a value carrying a NUL byte  |
        | "--help"                     |
        | a value carrying U+2028      |
        | a 201-character value        |

    Scenario Outline: A model value within the grammar is used as configured
      Given a configured alternate model for the reviewer agent of <value>
      And the reviewer agent's default model never answers
      When the independent review runs
      Then the reviewer is asked to review on that model

      Examples:
        | value                        |
        | "claude-sonnet-4-5-20250929" |
        | "gpt-5-codex"                |
        | "vendor/model:tag"           |
        | "o3_mini.v2"                 |
        | a 200-character value        |

    Scenario: The accepted model grammar is exactly the stated one
      Given a configured alternate model for the reviewer agent
      When the value is judged against the grammar
      Then it is accepted only if it is 1 to 200 characters long
      And every character is an ASCII letter, digit, dot, underscore, colon, slash or hyphen
      And it does not begin with a hyphen

    Scenario: A configured model reaches the reviewer as one literal value
      Given a configured alternate model for the reviewer agent
      And the reviewer agent's default model never answers
      When the independent review runs
      Then the reviewer is asked for that model as a single unsplit value

  @reliable-reviews-for-real-packets.TBU3.R4 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU3.R4 — Each attempted route gets its own attempt budget, so an exhausted first route cannot leave the retry with no time to run

    Scenario Outline: A route failing any way still leaves the next route its own budget
      Given a configured alternate model for the reviewer agent
      And the reviewer agent's default model <failure>
      And the reviewer agent's alternate model answers promptly
      When the independent review runs
      Then the review returns the alternate model's verdict

      Examples:
        | failure                          |
        | uses its entire budget silently  |
        | crashes before answering         |
        | answers outside the contract     |

    @rejection
    Scenario: A route cannot borrow time from the next route's budget
      Given a configured alternate model for the reviewer agent
      And the reviewer agent's default model never answers
      When the independent review runs
      Then that route is stopped at its own attempt budget
      And the alternate model still receives a full attempt budget

  @reliable-reviews-for-real-packets.TBU3.R5 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU3.R5 — Every route is tried in a fixed order; the run bound stops any route that has not answered yet, while an answer already complete when the bound fires still counts

    @rejection
    Scenario: The run bound wins over trying the remaining routes
      Given a configured alternate model for the reviewer agent
      And the run bound is reached while the second route is still working
      When the independent review runs
      Then the author's own runtime is never attempted
      And the review reports that no route completed

    Scenario: A route considers at most the first eight candidate executables
      Given twelve installed reviewer executables for one route, in a fixed order
      When the independent review runs
      Then only the first eight are asked what they support or asked to review
      And the last four never run and never affect how the route is reported

    Scenario: Every route is tried, in order, before the run gives up
      Given a configured alternate model for the reviewer agent
      And no route ever answers
      When the independent review runs
      Then these routes were each attempted once, in this order:
        | route                                 |
        | the reviewer agent on its usual model |
        | the reviewer agent on its alternate model |
        | the author's own runtime              |
      And the review reports that no route completed

    @rejection
    Scenario Outline: Review work stops by the run bound however its routes fail
      Given a configured alternate model for the reviewer agent
      And a review packet at the largest size the coordinator accepts
      And every route fails by <failure>
      When the independent review runs
      Then no reviewer is still being waited on after 9 minutes
      And no route is attempted a second time

      Examples:
        | failure                                    |
        | never answering                            |
        | hanging on the capability question         |
        | failing to launch                          |
        | answering outside the contract every time  |
        | ignoring being asked to stop               |
        | a mixture of all of these across routes    |

    Scenario Outline: An answer landing exactly on the run bound wins the tie
      Given a valid answer and the 9-minute run bound fall on the same instant
      And the <first> event is handled first
      When the run bound is reached
      Then the review returns the reviewer's verdict

      Examples:
        | first     |
        | answer    |
        | run bound |

    @rejection
    Scenario: An answer landing on the run bound is still checked before it counts
      Given an answer that does not follow the result contract and the 9-minute run bound fall on the same instant
      When the run bound is reached
      Then the answer is refused
      And the review reports that no route completed

    Scenario: The command returns by the bound plus its cleanup budget
      Given a configured alternate model for the reviewer agent
      And the run has reached the 9-minute bound with a reviewer that cannot be stopped
      When the run bound is reached
      Then the command returns no later than 9 minutes and 5 seconds after it started

    @rejection
    Scenario: A run is stopped at the run bound when no answer has landed
      Given a configured alternate model for the reviewer agent
      And the run has reached exactly 9 minutes with a route still working
      When the run bound is reached
      Then the run stops
      And the review reports that no route completed

  @reliable-reviews-for-real-packets.TBU3.R6 @surface.claude-code @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU3.R6 — The public review command carries all of this end to end, and the required-review policy decides on what it reports

    Scenario Outline: The public review command completes through the alternate-model route
      Given a <author>-authored change and a configured alternate model for the reviewer agent
      And the reviewer agent's default model never answers
      When a builder runs the public review command
      Then the command reports a full cross-agent check by <reviewer>
      And it names the alternate model it used

      Examples:
        | author | reviewer |
        | Claude | Codex    |
        | Codex  | Claude   |

    Scenario: A required review accepts an alternate-model cross-agent result
      Given a required cross-agent review policy
      And the reviewer agent's alternate model completed the review
      When a builder runs the public review command
      Then the command reports the required check as satisfied

    @rejection
    Scenario: A required review refuses an author-runtime result
      Given a required cross-agent review policy
      And only the author's own runtime completed the review
      When a builder runs the public review command
      Then the command reports the required check as unsatisfied
      And it explains why the reviewer agent could not be used

  @reliable-reviews-for-real-packets.NTB1.R1 @surface.claude-code @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.NTB1.R1 — When both routes fail, the explanation names each route's own cause, not one generic failure

    Scenario: A timeout and a rejected answer are explained as two distinct causes
      Given the assigned reviewer timed out
      And the fallback reviewer's answer did not follow the result contract
      When the exhausted-route result is reported
      Then the explanation says the assigned reviewer ran out of time
      And the explanation says the fallback reviewer's answer was not in the required form

    Scenario: A missing reviewer and a timed-out fallback are explained as two distinct causes
      Given the assigned reviewer is not installed
      And the fallback reviewer timed out
      When the exhausted-route result is reported
      Then the explanation says the assigned reviewer is not installed
      And the explanation says the fallback reviewer ran out of time

    Scenario: All three routes failing keeps all three causes distinct
      Given the reviewer agent on its usual model timed out
      And the reviewer agent on its alternate model is not signed in
      And the author's own runtime answered outside the result contract
      When the exhausted-route result is reported
      Then the explanation gives each of the three routes its own cause
      And the explanation identifies the alternate-model route without naming the model

    Scenario: Three different causes still yield exactly one thing to do next
      Given the reviewer agent on its usual model timed out
      And the reviewer agent on its alternate model is not signed in
      And the author's own runtime answered outside the result contract
      When the exhausted-route result is reported
      Then the result offers exactly one next step to take
      And that next step addresses the reviewer agent's own failure

    Scenario: An exhausted run offers one thing to do next
      Given the assigned reviewer timed out
      And the fallback reviewer's answer did not follow the result contract
      When the exhausted-route result is reported
      Then the result offers exactly one next step to take

    Scenario Outline: The offered next step matches what actually went wrong
      Given the assigned reviewer <cause>
      When the exhausted-route result is reported
      Then the offered next step is to <remedy>

      Examples:
        | cause                            | remedy                        |
        | is not installed                 | install the reviewer          |
        | is not signed in                 | sign in to the reviewer       |
        | timed out                        | retry the review              |
        | is too old to be used            | update the reviewer           |
        | could not be launched            | check the reviewer runs       |
        | crashed                          | retry the review              |
        | answered outside the contract    | retry the review              |
        | could not be given the contract  | retry the review              |

    @rejection
    Scenario: An exhausted run never claims a review happened
      Given the assigned reviewer timed out
      And the fallback reviewer's answer did not follow the result contract
      When the exhausted-route result is reported
      Then the result records no verdict

  @reliable-reviews-for-real-packets.NTB1.R2 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.NTB1.R2 — An explanation never carries raw reviewer output, diagnostic noise, or credentials

    Scenario: An explanation is built only from Safe Word's own failure classification
      Given any failed review route
      When the exhausted-route result is reported
      Then the explanation is composed only of the route and its classified cause

    @rejection
    Scenario Outline: Nothing a reviewer emits reaches the explanation
      Given a reviewer that fails while emitting a credential in <channel>
      When the exhausted-route result is reported
      Then the explanation contains neither that text nor the credential

      Examples:
        | channel                          |
        | its diagnostic error output      |
        | its answer output                |
        | an unreadable answer             |
        | a crash message                  |
        | the error from failing to launch |
        | its own executable path          |
        | the arguments it was launched with |

    @rejection
    Scenario: A rejected answer is never echoed back to the builder
      Given a reviewer answer that does not follow the result contract
      When the exhausted-route result is reported
      Then the explanation does not contain the rejected answer

  @reliable-reviews-for-real-packets.NTB1.R3 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.NTB1.R3 — A review that ran but was not independent still never satisfies a required cross-agent check

    @rejection
    Scenario: A required cross-agent check is not satisfied by the author reviewing itself
      Given a required cross-agent review policy
      And only the author's own runtime completed the review
      When the review result is reported
      Then the required cross-agent check is not satisfied

    Scenario: A preferred policy still returns a verdict labelled as not independent
      Given a preferred cross-agent review policy
      And only the author's own runtime completed the review
      When the review result is reported
      Then the review returns a verdict
      And the result reports that the check was not independent
