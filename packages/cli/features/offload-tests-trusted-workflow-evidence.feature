Feature: Trust only the managed verification workflow

  @wip @offload-tests.TBU1.R12
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R12 — Only the exact trusted managed workflow version can produce authoritative remote evidence

    @surface.github-actions-execution-sandbox
    Scenario: Exact workflow bytes at both trust boundaries produce eligible evidence
      Given the bundled exact-byte SHA-256 matches the workflow at the observed default-branch SHA
      When the accepted run reports that same workflow-source SHA and bytes
      Then its supported pending identity remains eligible for authoritative evidence

    @rejection @public-cli @surface.safeword-cli @surface.github-actions-execution-sandbox
    Scenario: Bundled workflow bytes cannot redefine their independent trusted hash
      Given a manually maintained test-owned literal manifest fixes the supported workflow version and lowercase SHA-256 independently of production template generation
      When production bundled bytes and a one-byte-mutated candidate are hashed
      Then only bundled bytes matching the literal hash remain eligible and changing production bytes or metadata cannot update the test-owned oracle

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Workflow identity divergence fails at its observed boundary
      Given workflow identity differs <boundary>
      When Safeword evaluates remote trust
      Then Safeword reports <outcome>
      Examples:
        | boundary | outcome |
        | during preflight | conclusive local fallback without dispatch |
        | at the accepted run source | authoritative integrity failure without local rerun |
        | because project configuration names different trusted bytes | rejection because configuration cannot redefine trusted bytes |

    @public-cli @surface.safeword-cli
    Scenario: A post-acceptance default-branch rename does not rewrite frozen run authority
      Given an accepted run's immutable workflow ID, path, source SHA and target identity match the authenticated pending record
      When repository metadata later renames or moves the default branch before result inspection
      Then result observation issues no current repository-metadata request, makes no mutable default-branch comparison, and the exact accepted run remains authoritative

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Exact-byte workflow identity rejects every normalization boundary
      Given a test-owned byte fixture differs from bundled trusted bytes only by <byte-mutation>
      When Safeword hashes raw locally bundled or independently base64-decoded GitHub contents bytes
      Then exact identity rejects the candidate before authoritative evidence
      Examples:
        | byte-mutation |
        | an empty file |
        | one added or removed final newline |
        | CRLF replacing LF |
        | a leading UTF-8 BOM |
        | one non-UTF-8 byte |
        | malformed contents-API base64 |
        | decoded bytes truncated below the declared size |
        | decoded bytes exceeding the documented size ceiling |
        | different bytes with YAML-equivalent meaning |

    @rejection @surface.github-actions-execution-sandbox
    Scenario: A default-branch workflow race can start repository code but cannot produce trusted evidence
      Given exact workflow bytes passed preflight and the default branch moves before GitHub resolves dispatch
      When the accepted run reports different immutable workflow-source bytes
      Then Safeword reports the documented execution limitation and authoritative integrity failure, supplied no Safeword secret or local credential, and starts no automatic local rerun

    @rejection @surface.github-actions-execution-sandbox
    Scenario: A substituted workflow cannot receive Safeword-owned sentinel credentials through the dispatch race
      Given local configuration, pending state and GitHub API authorization use distinct test-owned sentinel values
      And a repository-controlled workflow replaces trusted bytes after preflight and records every received input, environment value, argument, pre-check file and credential-helper setting
      When GitHub starts that substituted workflow from the moved default branch
      Then its captured channels contain only the five allowlisted identity inputs and no Safeword-owned sentinel, while Safeword rejects its source identity without fallback

    @rejection @public-cli @surface.safeword-cli @surface.github-actions-execution-sandbox
    Scenario: Canonical API authorization placement never follows a redirect
      Given the production HTTP transport receives a usable test credential with a unique canary and independently captured direct and redirect response fixtures
      When it sends the canonical-origin request and receives each fixture
      Then the canary appears only in the initial canonical Authorization header, no redirected request is sent, and pending bytes contain no credential

    @live @real-github @rejection @public-cli @surface.safeword-cli @surface.github-actions-execution-sandbox
    Scenario: A usable API credential is absent from every workflow-visible channel
      Given an independently verified usable live GitHub credential has a test-owned canary hash and a disposable repository can deterministically move from exact preflight bytes to a substituted capture workflow
      When the public CLI dispatches and that substituted workflow successfully captures inputs, environment, arguments, files and credential helpers
      Then no captured value matches the credential or canary, the raw direct request proves Authorization placement, and any fixture failure leaves the live gate incomplete rather than skipped
