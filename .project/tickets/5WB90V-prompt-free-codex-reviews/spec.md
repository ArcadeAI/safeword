# Product Plan: Run independent Codex reviews through the Safeword plugin

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** Codex's built-in workspace profile blocks shell network access. A custom reviewer domain profile would ask customers to change permissions, while an out-of-sandbox command rule would grant Bun more access than the review needs.
- **Expected outcome:** A normal Safeword plugin install exposes bounded, prompt-free quality, scenario, and plan reviews through a narrow MCP interface. Customers keep their Codex permission profile and config unchanged.
- **Success threshold:** A fresh plugin install under Codex's built-in workspace profile completes a real independent review, from tool discovery through a terminal result and signed receipt, without a prompt or custom permissions config. Reviewed source remains unchanged.
- **Project non-goals:** Executing RED proofs through MCP; changing Codex permission profiles, rules, or hook trust; making cloud-only local subprocesses work; hiding the fact that bounded packet contents go to a reviewer provider.

## Jobs To Be Done

### prompt-free-codex-reviews.TBU1 — Keep authorized reviews running

**Persona:** Technical Builder (TBU)

> When I install Safeword in Codex, I want independent reviews to complete without repeated approval interruptions or permission setup.

#### prompt-free-codex-reviews.TBU1.R1 — Narrow review interface

The Codex plugin provides tools to start and check independent quality, scenario, and implementation-plan reviews. The tools accept only an absolute project root and bounded project-relative target/context file paths. They use the existing coordinator, its packet limits, policy opt-out, reviewer routing, and source-integrity checks. A review may send the bounded packet to the selected provider and use temporary files; the coordinator stores a signed receipt under `.safeword/state/reviews` so the normal gate can verify the verdict and source freshness. It does not alter reviewed source. Codex does not currently supply an authenticated active-workspace root to plugin MCP servers, so the model supplies the root and the coordinator confines paths within that root. Executable RED remains in the normal workspace sandbox because it executes project commands.

#### prompt-free-codex-reviews.TBU1.R2 — Installation needs no permission profile change

The plugin bundles the local MCP server and points Codex to its versioned runtime using a plugin-root-relative working directory. Quality, scenario, and plan review instructions use the MCP tools. Installation and upgrades do not add a Codex profile, network allowance, out-of-sandbox rule, or tool-approval override. If the tools are unavailable or fail to start, guidance reports the route unavailable without escalation. The MCP process has ordinary local process access outside the shell sandbox, so its public tool surface stays limited to the review operations in R1.

#### prompt-free-codex-reviews.TBU1.R3 — Terminal proof under default permissions

Verification installs the built plugin in a disposable Codex home and reviews a synthetic file under the built-in workspace permissions. A pass requires discovery, a call without approval, a terminal result from a different reviewer, and a signed receipt accepted by the normal Safeword gate. Reviewed source remains unchanged. `running`, unknown, failed, blocked, or degraded results do not count as independent completion. The status tool revalidates review IDs after server restart rather than relying on in-memory state.

## Shape

### M1 — Plugin-backed Codex reviews

- **Outcome:** The installed Codex plugin runs ordinary reviews without customer permission setup.
- **Non-goals:** Executable RED through MCP or a general-purpose unsandboxed command tool.

## Killer Demo

> Install Safeword in a fresh Codex home, leave the workspace profile untouched, review a tiny file with an obvious defect, and receive an independent finding without an approval prompt.

## Surfaces

Affected:
- OpenAI Codex

Unaffected:
- Claude Code and Cursor retain their host-native review commands.
