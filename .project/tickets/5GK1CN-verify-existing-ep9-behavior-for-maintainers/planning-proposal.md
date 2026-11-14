# Bounded EP9 current-proof proposal

Status: draft planning only. User authorized this plan, not implementation,
paid review, qualification, route changes, merge or release. No approval stamp
or authority to code is claimed. EP9 itself remains unchanged and incomplete.

Review update: one ordinary paid planning review was subsequently authorized.
Review 628139a4-556a-439b-b9c1-381546f595d0 requested changes, with cross-agent
Claude Opus 5.5 feedback. The proposed shared-signer trust decision is withdrawn:
fabricated fresh execution followed by fresh review remains unresolved. The
resolver can be reused, but that alone does not establish execution provenance.

## Chosen approach

Current normative approach: ci-provenance-design.md and current ticket/spec,
scenarios and dimensions. Add a fixed CI execution producer/import adapter to
the existing current-proof engine; local shared signatures alone are rejected.
Trust the installed verifier and embedded roots/pins, with no OS-hardening claim.
The original profile-only sequence below is historical rationale, superseded
where it omits CI provenance, direct closing signature verification or freshness.

Add one installed EP9K2Y profile to the existing current-proof machinery.
Do not introduce another receipt engine, broad eligibility switch or a manual
checkbox exemption. Existing T0FK4H authority and historical records stay intact.
This ticket has no eligibility to use the exception it creates.

The profile must be reviewed and installed as a separate trusted change before
it can certify EP9. A candidate cannot authorize its own profile, redefine the
verifier it uses, or supply its own approval. Reuse existing verifier/subject
separation where it suffices; proving this trust boundary is the first design
check, not an assumption that a new ticket alone establishes independence.

## Fixed proof boundary

Bind the exact EP9 ticket/spec, feature, 64-case proof map, historical ledger,
test selectors and harness inputs. Freeze hashes only after the candidate's
remaining two CLI contract repairs; later relevant changes revoke the result.
One ID-list addition cannot establish these bindings.

Exact feature/map paths: features/verify-current-proof-for-t0fk4h.feature and
features/verify-current-proof-for-t0fk4h.bdd-proof.json. The two remaining repairs
are recorded in EP9's completion-blocker.md under Concrete repairs waiting for
authority: expected canonical names in tests/cli-protocol/catalog.test.ts and
the review current-proof group in src/cli-protocol/catalog.ts (package-relative).
Group 1 needs its own EP9-bound observation proving the observer behavior; a
T0FK4H observation/receipt cannot substitute for that proof.

Require actual current execution for all eight EP9 groups:

1. Complete fixed serial observation of the seven T0FK4H behaviors.
2. Refusal of changed scope and incomplete execution.
3. Current qualified independent certification covering the whole observation.
4. Refusal of unqualified, partial, reduced or otherwise invalid review.
5. Revocation after changed or missing bound evidence.
6. Ordinary prerequisites still enforced at local closing boundaries.
7. Only the intended delivery completes; original missing history stays visible.
8. Unsupported hosts and unavailable trusted closing support refuse safely.

Use the existing feature-to-test map as the inventory, not as proof that tests
actually ran. Current integration fixtures prove mechanisms; separately record
actual installed Claude, Codex and Cursor walkthroughs. OpenCode/cloud cases
remain deferred. No synthetic model/producer identity counts outside fixtures.

## Admission and closing

Fresh independent qualified review must judge coverage, not merely a green
test count. Bind its authenticated receipt to the actual observer execution,
candidate identity, profile and verifier identity. Recheck those identities at
row admission and closing. A later failure or removed evidence revokes credit.

Record distinct current-proof credit with historical_red=missing where history
is absent. Preserve every original RED/GREEN/REFACTOR row and failed, stale,
rejected or exhausted review; do not relabel replay as historical TDD. Check
cross-scenario disposition and ordinary dependency/test/scope checks separately.
Do not inherit T0FK4H's special seven-proof coverage definition for EP9.

## Smallest delivery sequence

1. Define scenarios and review the trust boundary without broadening eligibility.
2. Prove a separately trusted verifier can refuse candidate-supplied profile,
   verifier and certification changes. If the existing engine cannot enforce
   this, return with a concrete design decision before adding a new mechanism.
3. Introduce a fixed two-profile selection using the existing engine and distinct
   bindings/coverage definitions; preserve exact T0FK4H behavior. No user-defined
   profile registry or future-ticket automation.
4. Add EP9 admission, revocation and local closing integration tests. This new
   feature follows genuine RED-first development; it receives no retrospective
   exemption and cannot certify itself.
5. Verify affected runtime mirrors and installed-host paths, preserving failures.
   Only after independent approval and explicit installation authority can EP9
   collect accepted current proof. No merge/install action is authorized now.

## Verification plan

- Wrong ticket, duplicate/missing coverage, wrong candidate/profile/verifier,
  manual receipt, altered subject and same-agent/reduced review all refuse.
- A real passing complete observation and independent receipt admit EP9 current
  credit without changing the historical ledger; revocation restores refusal.
- T0FK4H still admits only its own seven proofs; EP9 cannot borrow that receipt.
- Claude/Codex/Cursor honor the same admission and ordinary prerequisites;
  unsupported producers/hosts remain refused, with all 33 deferrals retained.
- Positive installed-host evidence is required; fixture-only success is labelled
  as such. No model qualification, historical RED or #4200 completion is inferred.

## Dependencies and risk

### Verifier-boundary inspection

Read-only inspection supports reusing the existing separation, rather than
building a new verification service:

- hooks/lib/current-proof.ts delegates admission to trustedSafewordClis, uses
  its first external runtime, sanitizes the environment and forbids downloading
  a missing cached package during the bounded check.
- hooks/lib/safeword-cli.ts canonicalizes script/runtime paths, refuses paths
  inside the candidate checkout and runs outside its working directory so
  candidate loaders, configuration and local binaries cannot answer the check.
- src/review/current-proof.ts binds profile, candidate, product subject, actual
  execution/report digests and authenticated review. Its product subject covers
  committed product paths and modes, rather than trusting a supplied HEAD label.
- Both hook and runtime currently hard-code T0FK4H. Changing only a hook or only
  the profile constant cannot safely admit EP9 or define its different coverage.

Decision: reuse this resolver and evidence engine with two explicit profiles.
Do not add an external service, general profile registry or weaker local-source
fallback. This inspection establishes an architectural fit, not tested security
or completion authority. The new feature must first prove denial for an external
symlink resolving into the candidate, candidate-supplied profile/runtime paths,
source-issued forged evidence, mismatched verifier provenance and a removed
trusted runtime. Inspect key ownership and authenticated execution provenance
while defining those tests; shared signing alone must not make candidate-authored
observations trusted. If the existing evidence checks cannot distinguish that
case, resolve it before implementing eligibility.

The prerequisite must be developed with genuine prospective failing tests and
ordinary independent review. Install its independently reviewed runtime only
through normal authorized distribution; never copy unreviewed EP9 code into a
plugin cache and call the copy independent. Installation/release authority is
still absent in this planning pass.

Corrected reviewer benchmarks still need independent review and fresh authorized
qualification. Sol's failed call remains unexplained. This proposal does not
remove those prerequisites or authorize their spend. The unfinished EP9 CLI
repairs and native proof must also finish before any closing claim.

Premortem: EP9 could approve itself indirectly through candidate-controlled
verifier code. Refuse that path and demonstrate independent verifier provenance
before extending eligibility. No repeated exception for the new prerequisite.
