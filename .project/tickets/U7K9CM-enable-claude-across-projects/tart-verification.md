# Claude scope verification in Tart

Date: 2026-09-02. Disposable clone: `safeword-scope-U7K9CM`, cloned from stopped `guard-spike`. No host directory mounts; audio and clipboard sharing disabled. VM stopped after verification. Host Claude profile was not used or modified.

## BDD acceptance

Ran `NODE_OPTIONS='--import tsx' node_modules/.bin/cucumber-js features/choose-claude-plugin-scope.feature features/native-claude-plugin.feature --format summary`.

Before expectation updates: 99/102 scenarios passed. The three failures expected project scope for omitted scope, fresh setup, and legacy setup. Updated those assertions to user scope; no other scenario expectations were changed.

After: 102/102 scenarios and 4,787/4,787 steps passed. These use isolated fake Claude adapters, not live model sessions.

## Real host installation

Guest: macOS 26.6.1 (25G76), Claude Code 2.1.258, Node 24.19.0, Bun 1.3.14.

Tested an npm-packed local CLI with the changed default, version 0.83.1, against the real official public marketplace and released Safeword 0.83.1 plugin. Tarball SHA-256: `a00fb19bdbc9f44098e75b40b3b0965d2fa97afb538d73f2a9c821853e81d445`. This verifies the installer change against a released plugin; it is not a published candidate-release upgrade check.

Each case used its own empty Claude configuration directory and two temporary Git projects. The changed package was installed only in the guest. No credentials were copied from the host.

| Invocation | Actual scope | Second project | Repeat plugin install | BDD skill discovery |
| --- | --- | --- | --- | --- |
| `safeword claude install` | user | user scope visible | no mutation | found |
| `safeword install --agents=claude --no-modify` | user | user scope visible | no mutation | found |
| `safeword install --agents=claude --no-modify --scope=project` | project | plugin missing, as expected | no mutation | found |

All cases preserved the unrelated profile sentinel and left the other scope without Safeword enablement. Claude's real plugin list reported enabled version 0.83.1 and a cache path inside the guest fixture. Second-project status deliberately reported `unproven` for user scope: installation is not execution proof.

Ran generated consumer `npm run test:bdd` in both unified-install projects: each passed 1 scenario / 3 steps. Project-local BDD scaffolding remains runnable for both activation scopes.

## Authenticated follow-up — 2026-09-03 UTC

The user logged into Claude inside the VM. SSH sessions required unlocking the guest login keychain in the same session as the Claude command; no credentials were exported or copied to the host.

Real Claude sessions used the installed global plugin and ordinary tool allowances, without `--dangerously-skip-permissions`, fake Claude adapters, or injected plugin paths.

- Primary project: Claude invoked `Skill` with `safeword:bdd`, read `skills/bdd/DISCOVERY.md` from the installed versioned user cache, and authored `.project/tickets/YDA70E-greeting-cli/ticket.md` and `spec.md`, plus a project persona. The final ticket has populated scope/out-of-scope/done criteria and remains at intake.
- Second project: with no project-local Safeword installation, a separate authenticated Claude session invoked the same BDD skill and read the same cached discovery guide successfully, without implementation or project writes by the agent.
- Each startup emitted nine successful SessionStart hook responses. Both projects have distinct current UserPromptSubmit execution proofs with their real session IDs, version 0.83.1, canonical cache root, and the expected hook-manifest SHA-256.
- `safeword claude status --json` reports healthy / plugin-mode / user scope in both projects.
- A real Edit tool call attempted to advance the first ticket prematurely. The readiness hook blocked the edit for a mismatched persona name and missing dimensions.md. The ticket remained at intake. The agent corrected the persona and completed intake without bypassing the gate or advancing the phase.

The initial intake run and first continuation reached the deliberately bounded turn limits (12 and 8). A final eight-turn-bounded continuation exited successfully after completing intake. The second-project run exited successfully within four turns. These limits interrupted the test harness; they were not installation failures.

## Remaining limit

This verifies authenticated BDD skill activation, intake artifact creation, cross-project availability, real hook dispatch/proof, and one readiness-gate rejection. It does not exercise a complete feature through scenarios, TDD, review, and closeout, or a published candidate-release upgrade. The installed plugin payload remains the released 0.83.1 version; the locally changed installer is what was under test.

## Local artifacts

Raw CLI JSON, real Claude observations, the VM script, BDD logs, the initial unauthenticated result, authenticated session transcripts, final intake artifacts, status JSON, and per-project execution proofs are saved under `/tmp/safeword-scope-evidence/`. VM is stopped and retained after the authenticated checks.

## Full lifecycle follow-up

Attempted the greeting feature through real BDD. Authored scenarios and implementation plan; supplemental reviews improved whitespace and error-output coverage. Independent review could not run: after correcting executable placement, Claude exits because `--strict-mcp-config` conflicts with the guest enterprise MCP configuration. No independent stamp was produced. TDD and closeout remain unverified. See reviewer-investigation.md for the reproduced error and options. Test session interrupted and VM stopped with artifacts retained.
