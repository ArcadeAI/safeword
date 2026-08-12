@wip
Feature: Reject invalid verification requests safely

  @offload-tests.TBU1.R9
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R9 — Invalid public syntax or unauthenticated derived revision data is rejected without local or remote execution

    @rejection
    Scenario Outline: Invalid requests execute nowhere
      Given the public command and Git collaborator expose <invalid-input>
      When the builder runs <public-command> before eligibility checks
      Then it exits nonzero with SAFEWORD_TEST_EXECUTION_INVALID naming <invalid-boundary>, invokes no plan command, sends no dispatch, creates no pending record, and changes no project configuration
      Examples:
        | invalid-input | public-command | invalid-boundary |
        | ordinary authenticated repository state | `safeword project test --lane unknown` | lane enum |
        | ordinary authenticated repository state | `safeword project test --lane done --revision HEAD` | unsupported revision option |
        | ordinary authenticated repository state | `safeword project test --lane done --ref refs/heads/main` | unsupported ref option |
        | ordinary authenticated repository state | `safeword project test --lane done --owner other` | unsupported owner option |
        | ordinary authenticated repository state | `safeword project test --lane done --repository other` | unsupported repository option |
        | production Git HEAD read returns an abbreviated, uppercase, option-like, whitespace-padded or multi-record value instead of one 40-lowercase-hex SHA | `safeword project test --lane done` | derived immutable revision |
        | production Git HEAD acquisition exits nonzero | `safeword project test --lane done` | derived immutable revision acquisition |
        | production Git HEAD acquisition returns empty output for an unborn or missing HEAD | `safeword project test --lane done` | derived immutable revision acquisition |
        | production Git HEAD acquisition exceeds its bounded timeout | `safeword project test --lane done` | derived immutable revision acquisition |
        | production Git HEAD acquisition is terminated by a signal | `safeword project test --lane done` | derived immutable revision acquisition |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Repository and branch canonicalization has one observable result
      Given authenticated repository metadata and local Git remotes present <identity-boundary>
      When the public CLI canonicalizes remote eligibility and constructs the refs API request
      Then <canonical-outcome>, and no rejected candidate receives authentication or becomes canonical
      Examples:
        | identity-boundary | canonical-outcome |
        | branch `feature/a.b_c-1` | the canonical `refs/heads/feature/a.b_c-1` value is retained and its slash is percent-encoded exactly once in path data |
        | a valid branch containing other Git-allowed non-option characters | Git check-ref-format decides validity and API path data is encoded exactly once |
        | an already percent-encoded or double-encoded branch input | input is rejected rather than decoded or encoded again |
        | owner or repository case differing from authenticated API canonical case | authenticated API owner and name become canonical without case-folded guessing |
        | one remote URL ending in `.git` | exactly one transport suffix is removed before API identity comparison |
        | an exact `https://github.com/owner/repository.git` URL without credentials, query, fragment or port | its owner and repository become only an unauthenticated candidate pending API canonicalization |
        | an exact `git@github.com:owner/repository.git` SCP-like URL | its owner and repository become only an unauthenticated candidate pending API canonicalization |
        | a renamed local remote with one canonical same-repository URL | local remote name is irrelevant and the canonical API identity is selected |
        | multiple remotes resolving to the same canonical repository and SHA | they collapse to one unambiguous identity |
        | multiple candidate remotes resolving to different canonical repositories | remote execution is ineligible before POST and local fallback preserves the lane |
        | an HTTPS URL containing embedded user information or credentials | that candidate is rejected before any network request |
        | an HTTPS URL containing a query or fragment | that candidate is rejected before any network request |
        | a GitHub-like path on any host other than exact `github.com` | that candidate is rejected before any network request |
        | an SSH or SCP-like URL with an extra colon, explicit or malformed port, missing owner, or ambiguous path | that candidate is rejected before any network request |
        | an owner or repository containing percent-encoded bytes | that candidate is rejected rather than decoded |
        | a repository ending in repeated `.git.git` suffixes | that candidate is rejected rather than repeatedly normalized |
