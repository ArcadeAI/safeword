# Supporting Design Detail Guide

The feature's `impl-plan.md` is the single design plan of record. Use a
separate, linked document only when a component diagram, interface example,
or data model would make a decision in that plan easier to inspect. Component
count and user-story count do not require another document.

## Before writing support

Read the accepted Product Plan, scenarios, Implementation Plan, and applicable
architecture records. Name the decision in `impl-plan.md` that this detail
supports and link the document from that decision. The plan must still state
the choice and consequence so a reviewer can understand it without hunting
through another authority.

Use `.safeword/templates/design-doc-template.md` only for sections that help
the decision: component responsibilities and interfaces, interactions, data
shape and flow, a representative user path, failure cases, and relevant
references. Delete unused sections. Do not duplicate the Product Plan's
behavior or create another list of accepted feature decisions.

If the detail reveals a new choice, decide and record it in `impl-plan.md`
before reviewing the feature design. A shared or difficult-to-reverse choice
may also need a linked durable architecture record. Exact implementation
steps, test commands, and release order belong in the Execution Plan.
