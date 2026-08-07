# Figure It Out: Review Follow-ups for Dependency Recovery

- [x] Phase 1: Frame the decision in one sentence
- [x] Phase 2: Generate 2-3 concrete options
- [x] Phase 3a: Enumerate relevant research domains
- [x] Phase 3b: Research each named domain
- [x] Phase 4: Debate, steelman both sides, commit to one

## Frame

Decide how to close the review’s remaining recovery gaps without turning the shared lightweight tokenizer into a full shell parser or allowing a partial install to certify a retry as ready.

## Options

1. Keep the dependency-only `&` check and document both gaps. Smallest immediate diff, but the kill and ledger gates still miss a shell list operator, while partial installs can still stamp readiness.
2. Teach the shared tokenizer that unquoted `&` is a list boundary and make the existing install classifier reject known partial/no-link installs. This repairs every consumer of the shared tokenizer and preserves one readiness definition for pre- and post-tool hooks.
3. Replace the tokenizer with a full Bash parser and inspect the installed tree after every install. Strongest possible proof, but substantial complexity, portability risk, and blocking-hook cost for a narrow safety gate.

## Research domains

- Bash list grammar and background execution
- Bun, npm, pnpm, and Yarn install/linking behavior
- Existing multi-gate parser consumers and false-positive boundary
- Hook latency and fail-closed enforcement scope

## Evidence

- GNU Bash defines `&` as a list operator and says it executes the preceding command asynchronously; it has the same lower precedence as `;`. [Bash Lists](https://www.gnu.org/software/bash/manual/html_node/Lists.html)
- Bun documents that `--production` and `--omit dev` exclude dependencies. [Bun install](https://bun.sh/docs/pm/cli/install)
- npm documents that `--omit` dependencies are not physically installed and that `--production` is an alias for omitting dev dependencies. [npm config](https://docs.npmjs.com/cli/using-npm/config/)
- pnpm documents that `--prod` removes dev dependencies and `--lockfile-only` writes nothing to `node_modules`. [pnpm install](https://pnpm.io/cli/install)
- Yarn documents that `--mode=update-lockfile` skips the link step. [Yarn install](https://yarnpkg.com/cli/install)

## Decision

Recommend **option 2** because a shared tokenizer that recognizes Bash’s actual list boundary fixes every current gate with less code than a one-off detector, and a shared non-reconciling install classification prevents the same partial tree from being both exempted and stamped ready. Option 1 preserves known holes; option 3 is disproportionate to a fast PreToolUse gate.

**Premortem:** The likely failure is misclassifying a redirection `&` as backgrounding or missing a partial-install form, so retain redirection-specific parser tests and add current manager examples to the shared classifier tests.

## Outcome

Implemented option 2. Canonical, dogfood, and Claude-plugin copies are aligned;
the focused and full test suites pass.

**Next:** Push the reviewed change and let PR CI validate the draft head.
