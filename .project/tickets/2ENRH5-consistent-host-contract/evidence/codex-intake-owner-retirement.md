# Retire Codex's independent intake decision

This component consumes the independently approved restored-baseline RED
917d4b64-62dd-438b-88f8-0d8c9d78988d. The fixture retains the complete original
predicate, denial codec and reachable decision route. It overlays current
tracked changes/deletions as well as current source, so generated and dogfood
mirrors do not silently stay at an earlier commit during template work.

The actual Codex adapter now delegates intake decisions entirely to the shared
pre-tool gate it already executes. Its private required-fields list, parser,
missing-field predicate, ticket matcher, denial codec and fallback call are
removed (89 lines). The real current source check no longer reports
codex.intake.required-fields; it still reports the two OpenCode authority
couplings and incomplete inventory. No owner-current seal or whole-repository
completion is claimed. The retained negative fixture still fails the actual
check for that precise owner and source path after reinsertion.

A behavioral RED showed why removing the second owner matters: the adapter
rejected editing an existing test-definition file with incomplete intake even
though the shared creation-only gate allowed it. The focused test failed with
ADAPTER_INTAKE_POLICY_OVERRIDES_SHARED_OWNER before removal. Existing creation
controls remain for both default and custom project namespaces.

The first removal exposed a preserved capability hidden by the duplicate:
the shared namespace path filter recognized only default/legacy labels. It now
accepts the already-resolved owning project as an optional argument and includes
its configured namespace. The pre-tool gate supplies the canonical project
path, matching its already-canonicalized edit target (important for macOS /var
versus /private/var). Its four ticket-path checks use that same shared helper.
Two-argument callers retain existing default/legacy behavior. Custom-root
positive and similarly-named-directory negative controls pass. No adapter-local
replacement predicate, configuration option or new runtime is added.

The native Codex catalogue run also exposed a shell-language instruction trap:
a model combined a variable assignment and use as an environment prefix, so
expansion happened before assignment. The portable runtime guidance now requires
separate semicolon-terminated assignment statements and explains that exact
invalid form. This is shared guidance, not a host-specific command repair.
Actual guide/helper/native CLI message and artifact assertions stay unchanged.

A separate native observer false negative rejected two valid missing-verification
explanations: 'Unable to satisfy the verification requirement without changing
files' and 'Unable to run verification…'. Both became failing unit examples
before the response parser was changed. It now recognizes inability to run,
complete or satisfy verification, while rejecting negated inability and existing
completed/unrelated/negated-gap controls. No native Stop input, block decision,
session binding, response count, continuation limit or missing-file assertion
was weakened. These are observation repairs, not a new production continuation
mechanism or a fabricated product RED.

Current verification:

- 4 files /95 focused tests pass (adapter, namespace, ownership and continuation
  observation), /tmp/safeword-owner-retirement-and-observation-green.log.
- Native Codex before retirement: all 5 cases /19 steps pass, KVrJhc.
- Native Codex after retirement: all 5 cases /19 steps pass, Zhfmiv, in
  /tmp/safeword-codex-owner-retirement-native-final.log. Only owned fixture
  package sources/caches were refreshed through the native plugin add command;
  trust-bearing hook and plugin manifests were byte-identical before refresh.
- Fresh V2 candidate native-v2-owner-retirement-20261021-1 and actual V1 controls,
  worker restrictions, optional rejection, required-worker rejection, commands
  and guide/helper probes all pass. The native-opencode group deliberately
  ends incomplete (3) for required host-schema rejection/status and complete
  case population; /tmp/safeword-opencode-after-owner-retirement.log.
- All five generated surfaces regenerated and verified. Cursor lifecycle fixture
  tree hashes change with template bytes; result hashes remain unchanged.
  Dogfood sync used the supported parity fixer after template edits.
- CLI types and targeted source lint pass. The explicit tsup entries exclude
  the source-ownership analyzer; none of 391 runtime sourcemap inputs contains
  that development-only TypeScript module.

The source analyzer additionally uses deduplicated input sets, rejects ambiguous
canonical declarations, unwraps standard TypeScript assertion/parenthesis forms,
and excludes type-only imports. Its stated partial scope remains: full facet
and lane discovery, bypass/repair controls, required CI wiring, sealed committed
owner deltas and customer admission are still unfinished. No healthy or
admission path was introduced. No scenario ledger checkbox is changed.

Review angles: preservation of shared policy and custom-root behavior; actual
removal rather than a parallel facade; fidelity of the negative fixture and
native observations; correct scope/limitations of the partial check; template
and generated runtime consistency. Relevant principles are one shared authority,
independent structural observation, add-never-replace and the smallest complete
mechanism. NTB/TBU experiential acceptance remains unproved here. Currency:
2026-10-21 from the host. Sources: exact native Codex 0.160.0 observations,
installed TypeScript 5.9.3 APIs, and https://bun.sh/docs/pm/bunx for unchanged
V1 package resolution; no latest-version substitution is used as proof.
