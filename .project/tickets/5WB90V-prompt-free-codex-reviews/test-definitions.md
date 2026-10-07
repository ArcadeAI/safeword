# Test Definitions: Run independent Codex reviews after one narrow approval

Feature source: `packages/cli/features/prompt-free-codex-reviews.feature`

## Rule: prompt-free-codex-reviews.TBU1.R1

### Scenario: Safeword exposes only bounded review operations

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every review kind returns a terminal verdict through MCP

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Executable RED stays outside the review interface

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid requests never reach a reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing review files do not reach a reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An empty target list does not reach a reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Coordinator policy opt-out blocks provider dispatch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Packet size follows the coordinator boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: prompt-free-codex-reviews.TBU1.R2

### Scenario: Generated review guidance names the MCP tools for every kind

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Plugin installation makes the review tools available

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unapproved review never dispatches silently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unapproved reviewer login cannot launch a CLI

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Claude installation exposes the same bounded review tools

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Claude review guidance discloses provider dispatch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: One explicit review approval changes only the review and reviewer-login tools

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Status and sign-in display add no approval prompts

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A conflicting customer policy prevents approval setup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Upgrading the plugin preserves customer permissions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unavailable review tools do not trigger an approval escalation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unreachable reviewer provider fails without permission escalation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: prompt-free-codex-reviews.TBU1.R3

### Scenario: Independent review finishes without repeat prompts after narrow approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: One-time approval also works under on-request policy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Non-independent review states never count as completion

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Self-review routing cannot claim independence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unavailable review IDs never count as completion

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A completed review remains verifiable after an MCP restart

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Changed sources invalidate the receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Edited review receipts cannot claim independent approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: prompt-free-codex-reviews.TBU1.R4

### Scenario: Review status identifies the assigned reviewer's authentication gap

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reviewer sign-in uses the exact URL printed by the assigned CLI

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reviewer login runs away from project configuration

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A second login cannot run beside the first for one review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An abandoned reviewer login terminates

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A blocked review can start a fresh login after its prior CLI ends

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reviewer sign-in details are unavailable after the MCP server restarts

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Claude host displays the Codex device sign-in code

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Signing in lets the same review finish independently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A login that fails before printing a URL gives no review evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An authentication error alone cannot create a sign-in link

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Login tools reject reviews that do not need authentication

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unsupported sign-in URLs are rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A different official sign-in URL is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The login tool never opens an off-domain CLI URL

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An official URL can be displayed for its signed review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The login tool opens the default browser without a shell

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Shell syntax in an official sign-in URL stays data

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: MCP Apps asks the host when the local browser opener cannot start

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A blocked browser opener leaves a clickable sign-in link

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
