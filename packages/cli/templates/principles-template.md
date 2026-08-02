# Principles

<!--
Project-wide principles that shape product, architecture, and delivery
decisions. Keep this set small and durable. A principle earns its place when it
changes a choice across multiple pieces of work; tactical recipes belong in
guides or patterns instead.

FORMAT

Each principle is a `##` block with:

- A short decision-shaping statement in the heading
- **Intent:** why the principle exists
- **Prefer:** the direction it favors
- **Avoid:** the failure mode it guards against
- **Evidence:** how a change can show it honored the principle

Work does not copy this catalogue into tickets. Agents load it as project
knowledge, record only applicable principles, and name the concrete consequence
and proof. Deliberate conflicts belong in the work's deviations or rationale.

EXAMPLES (uncomment, customize, then delete this comment)

## Delight the user

**Intent:** Make the important path feel unexpectedly effortless.

**Prefer:** Immediate value, clear recovery, and minimal learning before success.

**Avoid:** Configuration before value and failures that strand the user.

**Evidence:** Behavioral scenarios prove the experience mechanics; a persona
walkthrough and real-user signals test whether those mechanics actually delight.

## Adopt and extend OSS before building bespoke

**Intent:** Spend project effort on differentiated behavior instead of rebuilding
mature ecosystem capabilities.

**Prefer:** Adopt, configure, wrap through public extension points, and contribute
upstream before implementing locally.

**Avoid:** Permanent forks, copied upstream source, and speculative wrappers.

**Evidence:** The implementation plan records the candidate survey, the chosen
extension boundary, compatibility proof, and the conditions that trigger a
reassessment.
-->
