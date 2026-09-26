# Product Plan: Run independent Codex reviews through the Safeword plugin

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** Codex's built-in workspace profile blocks shell network access. A custom reviewer domain profile would ask customers to change permissions, while an out-of-sandbox command rule would grant Bun more access than the review needs.
- **Expected outcome:** Safeword offers a one-time, tool-specific Codex approval for bounded independent reviews. The Claude and Codex plugins show a reviewer sign-in link when the other CLI is not authenticated, with an MCP Apps view where supported and a text link elsewhere.
- **Success threshold:** After one explicit, tool-specific approval, a fresh Codex plugin install completes repeated independent reviews without repeated prompts. When the reviewer is signed out, the exact CLI-generated URL and any device code are shown in Claude and Codex. Reviewed source remains unchanged.
- **Project non-goals:** Executing RED proofs through MCP; broad Codex profile or shell rules, silent permission grants, hook trust, and cloud-only local subprocesses; hiding the fact that bounded packet contents go to a reviewer provider.

## Jobs To Be Done

### prompt-free-codex-reviews.TBU1 — Keep authorized reviews running

**Persona:** Technical Builder (TBU)

> When I install Safeword in Codex or Claude, I want independent reviews to complete with one clear setup choice and a direct sign-in handoff when the other reviewer needs authentication.

#### prompt-free-codex-reviews.TBU1.R1 — Narrow review interface

The Codex plugin provides tools to start and check independent quality, scenario, and implementation-plan reviews. The tools accept only an absolute project root and bounded project-relative target/context file paths. They use the existing coordinator, its packet limits, policy opt-out, reviewer routing, and source-integrity checks. A review may send the bounded packet to the selected provider and use temporary files; the coordinator stores a signed receipt under `.safeword/state/reviews` so the normal gate can verify the verdict and source freshness. It does not alter reviewed source. Codex does not currently supply an authenticated active-workspace root to plugin MCP servers, so the model supplies the root and the coordinator confines paths within that root. Executable RED remains in the normal workspace sandbox because it executes project commands.

#### prompt-free-codex-reviews.TBU1.R2 — One narrow approval, explicitly chosen

Both plugins bundle the same bounded review MCP tools. Codex offers a one-time, user-visible choice to approve only `safeword_review.start_review`; it does not silently grant permission or change the workspace sandbox. A revoked or conflicting approval is preserved. Later checks use that choice without another prompt. If the tool is unavailable or blocked, guidance reports the route unavailable without shell escalation.

#### prompt-free-codex-reviews.TBU1.R3 — Signed independent proof

Verification installs the built plugin in a disposable Codex home and reviews a synthetic file under built-in workspace permissions with the explicit narrow tool approval. A pass requires discovery, a call without repeated approval, a terminal result from a different reviewer, and a signed receipt accepted by the normal Safeword gate. Reviewed source remains unchanged. Running, failed, blocked, stale, or degraded results do not count as independent completion. The status tool revalidates review IDs after server restart.

#### prompt-free-codex-reviews.TBU1.R4 — Sign in to the assigned reviewer

When the coordinator reports that the assigned reviewer is not authenticated, the calling agent runs the coordinator's exact login command in a visible interactive terminal and keeps it open. It captures the HTTPS URL printed by that CLI and any Codex device code. A bounded display tool checks the signed review result and the reviewer's official sign-in domain, then returns the exact link and code as text and an MCP Apps view. The view automatically requests that its host open the URL in the default browser. If the host cannot render the view, the agent tries the local operating system's default URL opener with that same URL as one argument. If either opener is unavailable or declined, the agent presents the exact clickable link and code in chat. The browser cannot open before the reviewer CLI prints its URL, and an authentication error alone does not generate one. The user completes the vendor login flow, and the agent retries the same review once. An unavailable URL or failed login never becomes independent review evidence.

## Shape

### M1 — Plugin-backed Codex reviews

- **Outcome:** The installed Claude and Codex plugins support the same reviewer sign-in handoff; Codex reviews run after one explicit, narrow approval.
- **Non-goals:** Executable RED through MCP or a general-purpose unsandboxed command tool.

## Killer Demo

> Install Safeword, approve only its review-start tool once, then run repeated reviews without repeated prompts. Sign out the other reviewer and receive its CLI-generated sign-in link, then finish the same review after signing in.

## Surfaces

Affected:
- OpenAI Codex
- Claude Code

Unaffected:
- Cursor retains its host-native review command.
