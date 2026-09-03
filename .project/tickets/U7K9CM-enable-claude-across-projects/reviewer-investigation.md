# Figure-it-out: restore a real reviewer inside the disposable VM

Decision: how to restore independent review without bypassing Safeword trust checks or expanding the application change.

Investigation plan:

- Runtime trust: which exact executable ancestor fails, and what does the implemented recovery require?
- Installation/authentication: can the already authenticated Claude installation serve as a supported fallback without replacing it or exporting credentials?
- Scope and reversibility: which option changes the least in this disposable VM while preserving reviewer independence?

Options:

1. Correct group-write permissions on the two guest Homebrew directories rejected by the reviewer trust check.
2. Reinstall Claude natively into a separate owner-only guest path.
3. Use same-agent supplemental feedback alone; this cannot satisfy the independent scenario/plan stamp gate.

Initial evidence: coordinator returns REVIEW_ROUTES_EXHAUSTED; Codex compatibility check cannot launch; Claude fallback is rejected for untrusted writable ancestors. Guest /opt/homebrew/bin and /opt/homebrew/lib are mode 775. No host directories are mounted.


Decision: use an APFS clone of the already installed native Claude executable in the owner-only guest `/Users/admin/safeword-review-tools` directory and put that directory first on the resumed test process PATH. Source and destination SHA-256 must match. This is the trust check's documented relocation remedy, not a disabled or bypassed check.

Evidence: Safeword runtime.ts resolves real executable paths, rejects group-writable ancestry, and already supports relocating a standalone executable into an owner-only cache. The installed binary itself is mode 755, owned by the guest user. The npm launcher ultimately runs a native binary; Anthropic documents that npm installs the same native executable as the standalone installer: https://code.claude.com/docs/en/installation . `codex --help` works from its original install; staging its JS launcher outside its package is a plausible explanation for the observed launch failure (not independently confirmed), but changing Codex/authentication is unnecessary for the documented Claude fallback.

Alternatives: correcting guest Homebrew directory permissions is smaller in commands but changes shared package-manager directories; a native reinstall adds a download and duplicate disk usage to a nearly full guest. Same-agent supplemental review provides feedback but cannot supply the required stamp.

Premortem: relocation could break a binary with adjacent resource dependencies; verify the unchanged binary launches and let the actual coordinator validate its capability and review result before accepting any evidence.

Next: resume the actual workflow with the trusted reviewer directory first on PATH and preserve the coordinator's typed independence result.

## Final diagnosis and stopping point

The relocated native executable passed trust checks, but the real coordinator returned `process_failed`. A minimal invocation with the same isolation flags reproduced exit 1 immediately:

```text
You cannot use --strict-mcp-config when an enterprise MCP config is present
```

Guest `/Library/Application Support/ClaudeCode/managed-mcp.json` exists and is root-owned. Its contents were not exported. Removing managed configuration or dropping isolation flags is not an acceptable test repair. The alternative independent Codex route still fails compatibility launch; establishing a separately authenticated supported reviewer or an appropriately provisioned VM is the next setup step. No credentials were exported and no review stamps were fabricated.

The model reached `plan-implementation` under the prefer policy after recording supplemental review with independence **none**. This is not evidence of independent review success. The session was interrupted and this task's VM stopped, preserving the artifacts. Full TDD, verification, and closeout remain unverified.

Evidence: `/tmp/safeword-scope-evidence/full-bdd-trusted-reviewer.jsonl` and `full-bdd-artifacts.tar.gz`. The VM is retained as `safeword-scope-U7K9CM`; the unrelated `guard-spike` VM was untouched.

## Authorized reviewer setup follow-up

The older local image also has managed MCP configuration. A copy-on-write inspection clone (`safeword-clean-U7K9CM`) was stopped without changing that configuration. Host available storage is about 13 GiB, so no large image download was attempted.

Selected the previously proposed Codex alternative in the original test VM. Copied its installed native Codex 0.152.1 executable with APFS cloning into the existing owner-only `safeword-review-tools` directory; all required reviewer CLI flags are present in its help. This avoids relocating a JavaScript launcher without its package. Created a separate guest Codex profile at `/Users/admin/safeword-scope-test/codex-reviewer-profile` and opened `login-reviewer.command` in the VM for user authentication. No host credentials or managed policy changes.

Next after login: use this CODEX_HOME and put safeword-review-tools first on PATH when resuming the authenticated Claude BDD session; require actual independent coordinator evidence before claiming lifecycle success.
