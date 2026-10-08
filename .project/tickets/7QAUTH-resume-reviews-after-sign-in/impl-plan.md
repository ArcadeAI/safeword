# Implementation plan

**Status:** planned
**Planned on:** 2026-10-08

## Approach

The riskiest assumption is that a vendor's successful login exit means credentials are usable in the assigned profile. The cheapest proof runs real synthetic vendor executables through login and a separate status command, with an already-authenticated default profile and an unauthenticated assigned profile.

Version-matched real-CLI contract proof is recorded in vendor-contract.json: Claude 2.1.289 and Codex 0.153.4 report authenticated default accounts but exit 1 under fresh empty CLAUDE_CONFIG_DIR/CODEX_HOME using the actual filtered environment. Claude reports the exact isolated configDirectory. No login, logout or credential copying was used. Claude's current documentation explicitly excludes shared Console OAuth profiles from directory partitioning; automatic continuation therefore requires authMethod claude.ai, loggedIn true and a matching configDirectory (available since 2.1.268). Codex must report ChatGPT authentication; API keys, workload/access-token modes do not qualify. Tagged Codex storage source scopes both file storage and keyring keys by CODEX_HOME. Unsupported or unverified status output leaves the review blocked for manual retry.

Both module and stdio proofs include successful-exit status responses that must be rejected: Claude Console/API-key authMethod, Claude mismatched configDirectory, and Codex API-key/access-token output. They assert no retry receipt and no reviewer dispatch. Initial guidance makes resumption conditional on account verification; server-local recovery outcome makes verification failure, expiry and changed requests observable through status with a manual-retry instruction. This transient outcome is bounded in memory and does not modify signed receipts. For the 9:59 integration boundary, the module test drives the controlled clock through the real signed-job continuation helper and waits for its worker verdict; stdio covers the ordinary full connected flow and actual shutdown.

Prove login completion using real child processes with synthetic vendor executables. Reuse the captured executable, temporary cwd, and filtered credential-profile environment for a bounded authentication status command. Only successful exit plus a successful assigned-profile check invokes continuation. Cancellation invalidates it before process cleanup.

Prove request binding through real signed jobs: reread original receipt, reject tampering, compare original source fingerprint and the captured project configuration digest, and accept only authentication-required review kinds exposed by MCP. Create a deterministic retry job ID derived from its parent under the existing launch lock. Record the parent ID on the new signed attempt; never rewrite the original. Original read-only status may follow only that validated child. Existing manual retries retain their current behavior.

New original jobs record a signed authentication binding digest of project configuration and credential-profile selectors. Legacy receipts without this binding retain manual retry; they cannot claim automatic continuation. Capture executable/environment at login start, validate them against the signed binding, and revalidate immediately before dispatch and again in the retry worker. The ten-minute login deadline covers the authentication check and callback; a shorter bounded check cannot hang. Cancellation wins once set, including a simultaneous successful exit. Closing the optional panel does not cancel the MCP connection.

The binding also covers the trusted executable's path/bytes, filtered vendor environment and configured route/model controls. Use the receipt signing key for the digest; never store raw credentials. Bind runtime dispatch inside the existing asynchronous review scope so only the captured executable/profile is used for this attempt; default review behavior stays untouched. A synchronous recheck immediately before each provider spawn closes the window left by asynchronous capability probing. Any binding failure terminates this attempt instead of selecting another reviewer.

Build login process tests first, then signed continuation integration tests and MCP wiring. Verify both vendor command variants and both generated plugin bundles. Existing tests remain unchanged.

| Scenarios | Primary proof | Boundary and build order |
| --------- | ------------- | ------------------------ |
| Confirmed sign-in, unsuccessful sign-in, wrong profile, cancellation, deadline | Integration: review-mcp-continuation.test.ts with supporting reviewer-login-continuation.test.ts | Real stdio and child executables, controlled clock for module expiry; first slice builds login module then MCP wiring |
| Request changes, sequential/concurrent completion, second authentication failure, passive status | Integration: job-continuation.test.ts | Real signed files and worker process; second slice |
| Source mutation during status, panel closed, EOF/SIGTERM, guidance | Integration: review-mcp-continuation.test.ts | Real stdio server and synthetic vendor process; third slice |
| Claude Code and OpenAI Codex surfaces | Integration plus generated bundle checks | Both command variants and host flags; no panel dependency |

No available language-specific skill adds a relevant TypeScript contract beyond the testing guide. Synthetic vendor executables replace the external account boundary, not the MCP server or signed store. Native panel rendering remains the existing separate host smoke proof; text/HTML continuation guidance is tested locally.

## Decisions

### Implementation Inspiration

| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --------- | ---------- | -------------- | -------------- | --------------- | ------------------- | -------------------------------------- |
| https://code.claude.com/docs/en/authentication | 2026-10-08 | Current docs checked with CLI 2.1.289 | Claude 2.1.289 | Real default/empty-profile status contrast recorded in vendor-contract.json | Require partitioned claude.ai profile and reported directory | Console OAuth profiles are shared and excluded; no copied code |
| https://raw.githubusercontent.com/openai/codex/rust-v0.153.4/codex-rs/login/src/auth/storage.rs | 2026-10-08 | rust-v0.153.4 | Codex 0.153.4 | Real default/empty-profile status contrast; keyring key derives from CODEX_HOME | Login exit plus profile status | File and home-keyed keyring supported; no copied code |
| https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/ | 2026-10-08 | Current article | Existing signed review jobs | Duplicate requests use one caller-bound identity | Atomic retry claim | General service guidance adapted to local file lock; no copied code |
| https://apps.extensions.modelcontextprotocol.io/api/interfaces/app.McpUiHostCapabilities.html | 2026-10-08 | Current MCP Apps reference | Existing MCP Apps panel | Messaging and opening links are optional host capabilities | Keep continuation server-owned | Host rendering does not establish author wake-up; documentation only |

**Decision impact:** retained: server completion plus a signed idempotent attempt avoids optional host messaging and restart machinery.
**Decision informed:** Continuation ownership

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Continuation ownership | Server login completion and assigned-profile status; references above | Panel callback; durable MCP Tasks | Optional host/panel lifecycle; draft negotiated Tasks adds restart scope |
| Retry identity | Deterministic parent-derived ID reserved by existing file lock; AWS reference above | Mutate original receipt; new persistent queue | Original must stay byte-identical; queue adds unused machinery |
| Request binding | Signed source/configuration/profile and executable binding, rechecked before worker dispatch | Login-time-only capture; arbitrary legacy auto-resume | Cannot prove original profile continuity or prevent source substitution |

An existing active manual review with the same packet prevents automatic dispatch; recovery reports that conflict instead of launching a duplicate. A linked retry cannot itself become an automatic-recovery parent. No new dependency, source redistribution, or external research disclosure is needed.

## Design alignment

Honor agent parity, signed receipt integrity, bounded provider dispatch, and source binding. Both native plugins use the shared source and generated runtimes. No new managed template files. Existing architecture owns review jobs and reconciliation; this adds a parent-child link inside that ownership boundary.

| Principle | Consequence | Proof | Conflict |
| --------- | ----------- | ----- | -------- |
| Optimize for the NTB without constraining the TBU | Finish sign-in without managing a retry command; retain original receipt and manual fallback | .project/tickets/7QAUTH-resume-reviews-after-sign-in/test-definitions.md | |
| 1. Structure enforces; instructions suggest | Signed binding and atomic attempt claim enforce one unchanged retry | .project/tickets/7QAUTH-resume-reviews-after-sign-in/test-definitions.md | |
| 5. Correct and safe; then clear; then simple | Executable/profile binding prevents a substituted process/account; file lock prevents duplicate paid work; dispatch-time checks stop drift during probing | .project/tickets/7QAUTH-resume-reviews-after-sign-in/test-definitions.md | |

Architecture: ARCHITECTURE.md's shared CLI ownership and generated native-plugin delivery remain intact. This adds optional signed record fields, preserving legacy manual status and retry compatibility.

## Known deviations

No restart recovery: server disconnect cancels pending continuation. Status confirms local credential availability rather than making an extra paid model request; a retry that still reports authentication required stops. A vendor executable update during sign-in invalidates its byte binding and requires manual retry; status explains that the original execution context changed.

## Doc impact

Update login text to promise automatic resumption only while connected. Review guidance continues polling the original ID; regenerated runtimes carry both hosts.

Configured README.md and website documentation will be checked for existing sign-in instructions and updated where they claim a manual retry is required. No unrelated documentation expansion.
Final build steps: update packages/website/src/content/docs/reference/configuration.mdx and extend ARCHITECTURE.md's Host-owned cross-agent adversarial review coordinator decision with the server lifetime and linked receipt behavior; validate formatting, then regenerate plugin bundles. README has no manual reviewer sign-in instructions to change. Existing guidance assertions will be checked; changing a shipped assertion still requires the user's explicit approval.

## Assessment triggers

Revisit for durable restart recovery, explicit host revocation signals, or guaranteed conversation wake-up. Changed source, configuration, reviewer, or integrity prevents dispatch.
