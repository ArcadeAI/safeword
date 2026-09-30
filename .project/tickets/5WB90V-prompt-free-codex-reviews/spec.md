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

The Codex plugin provides `start_review`, `review_status`, `start_reviewer_login`, and `show_reviewer_login` for independent quality, scenario, and implementation-plan reviews and sign-in. The review tool accepts only a canonical, non-symlink Safeword project root carrying a regular `.safeword/config.json` marker and bounded project-relative target/context paths whose canonical resolved files remain inside that root; a missing marker or symlink root is rejected before dispatch. The marker narrows eligible roots but is not proof that the host selected that workspace. It uses the existing coordinator, its packet limits, policy opt-out, reviewer routing, and source-integrity checks. A review may send the bounded packet to the selected provider and use temporary files; the coordinator's worker launched by `start_review` stores a signed receipt only under that marker-verified root's `.safeword/state/reviews` so the normal gate can verify the verdict and source freshness. `review_status` and `show_reviewer_login` do not write files, launch processes, terminate workers, or open a browser absent an explicit user click in the view while reading that state. Both Claude and Codex guidance disclose that bounded packet contents go to the reviewer provider, and the Codex setup choice repeats that disclosure. It does not alter reviewed source. Codex does not currently supply an authenticated active-workspace root to plugin MCP servers, so the server verifies the project marker before confining targets to the supplied root. Executable RED remains in the normal workspace sandbox because it executes project commands.

#### prompt-free-codex-reviews.TBU1.R2 — One narrow approval, explicitly chosen

Both plugins bundle the same bounded review MCP tools. Codex offers a one-time, user-visible choice to approve only `safeword_review.start_review` and `safeword_review.start_reviewer_login` in the user's Codex `config.toml`; before writing, it explains that bounded packets reach the reviewer provider and that both review workers and the assigned login CLI run outside the author shell sandbox; login may open its sign-in URL. The choice writes the two tool entries atomically, leaves unrelated policy intact, and can be reversed by removing those entries in Codex settings; durable revocation uses an explicit deny entry, which future setup attempts preserve. It does not silently grant permission or change the workspace sandbox. A revoked or conflicting approval is preserved; setup detects any conflict before writing either grant, writes neither, and reports an error rather than claiming success. Plugin upgrades and installs without the explicit --approve-reviews flag never write approval entries. The two approved tools are annotated as state-changing; `review_status` and `show_reviewer_login` remain genuinely read-only and require no approval. Later checks use that choice without another prompt. If a tool is unavailable or blocked, guidance reports the route unavailable without shell escalation.

#### prompt-free-codex-reviews.TBU1.R3 — Signed independent proof

Verification installs the built plugin in a disposable Codex home and reviews a seeded synthetic file under built-in workspace permissions and approval policy `never`. A no-grant control in that same disposable profile must show the host refusing `start_review`; then the shipped `codex install --approve-reviews` choice writes exactly the two R2 tool entries, preserving pre-existing unrelated config byte-for-byte and adding no plugin- or server-wide approval. A conflicting-deny control must report setup ineffective and grant nothing. A pass then requires discovery and at least two consecutive independent terminal reviews without another prompt; each review's assigned reviewer, different from the requesting agent, must identify the seeded defect and produce a signed receipt accepted by the normal Safeword gate. Reviewed source remains unchanged. Running, failed, blocked, stale, or degraded results do not count as independent completion. The status tool revalidates review IDs after server restart. Policy `never` proves that the host executed through its allow list without an interactive prompt. The same installed profile must also run `start_review` under Codex `on-request` approval policy and record a completed tool call with no approval event; this observed run proves the default prompting path uses those same two grants.

#### prompt-free-codex-reviews.TBU1.R4 — Sign in to the assigned reviewer

When the coordinator reports that the assigned reviewer is not authenticated, the calling agent invokes the approved login tool with that signed review ID. The tool maps the assigned built-in reviewer identifier to fixed Claude or Codex login arguments and a trusted installed executable resolved from installation candidates to an absolute path outside the reviewed workspace, after rejecting candidates with writable or project-controlled ancestry; it rejects relative and workspace-resident executable paths, and project configuration cannot supply the binary path or arguments. It launches that CLI outside the author shell sandbox, in a temporary directory with a filtered environment that retains the user's existing vendor credential home, so login persists where a retried review reads it. It captures the CLI's HTTPS URL and any Codex device code and keeps at most one process per review alive for at most ten minutes. The process ends on completion, failure, timeout, or server shutdown. It checks the review result and official sign-in domain before returning the exact link and code as text and an MCP Apps view. `show_reviewer_login` may display only the URL and code captured from that review's live CLI process; mismatches are rejected, and its view waits for a user click before opening the link. Captured sign-in material is in memory only and is unavailable after the login process exits or the MCP server restarts; the user can start a fresh login for the same blocked review. Only after the captured URL passes the same HTTPS and assigned-reviewer official-domain check used for the returned link does the approved login tool ask a fixed operating-system browser opener to open the complete URL as one argument without a shell; failed validation returns a bounded error without any browser-open request. If that opener cannot start, the MCP Apps view requests that its host open the URL. If neither opens the page, the agent presents the exact clickable link and code in chat. The browser cannot open before the reviewer CLI prints its URL, and an authentication error alone does not generate one. The user completes the vendor login flow, and the agent retries the same review once. Verification requires observed installed Codex and Claude host runs with a genuinely signed-out assigned reviewer, approval policy `never`, and only the two R2 grants: each must surface the exact CLI-printed URL and any device code without another approval, reject an invented official-domain URL, then accept a signed receipt from the retried review after real vendor sign-in. The evidence record identifies the host command, URL host and code presence without secrets, review ID, and gate result; an unobserved run does not satisfy this criterion. An unavailable URL or failed login never becomes independent review evidence.

## Shape

### M1 — Plugin-backed Codex reviews

- **Outcome:** The installed Claude and Codex plugins support the same reviewer sign-in handoff; Codex reviews run after one explicit, narrow approval.
- **Non-goals:** Executable RED through MCP or a general-purpose unsandboxed command tool.

## Killer Demo

> Install Safeword, approve only its review and reviewer-login tools once, then run repeated reviews without repeated prompts. Sign out the other reviewer and receive its CLI-generated sign-in link, then finish the same review after signing in.

## Surfaces

Affected:

- OpenAI Codex
- Claude Code

Unaffected:

- Cursor retains its host-native review command.
