Feature: Fall back locally for ineligible remote requests

  @wip @offload-tests.TBU1.R4
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R4 — A valid request that is remotely ineligible or explicitly rejected resolves and runs the same Safeword test-plan lane locally while identifying the local revision and dirty state

    @public-cli @surface.safeword-cli
    Scenario Outline: Conclusive remote unavailability falls back through the real plan resolver
      Given a valid <lane> request has <unavailability>
      When the public Safeword CLI establishes that no remote run was created
      Then it resolves <plan-kind>, reports local fallback with HEAD and dirty state, invokes the unchanged plan command once, and exits with that evidence-qualified local result
      Examples:
        | lane | plan-kind | unavailability |
        | done | test | missing authentication at preflight |
        | full | verify | missing authentication at preflight |
        | done | test | configured or required proxy use detected before POST |
        | full | verify | configured or required proxy use detected before POST |
        | done | test | missing managed workflow at preflight |
        | full | verify | missing managed workflow at preflight |
        | done | test | a parsed GitHub 400 rejection with request ID |
        | full | verify | a parsed GitHub 400 rejection with request ID |
        | done | test | a parsed GitHub 401 rejection with request ID |
        | full | verify | a parsed GitHub 401 rejection with request ID |
        | done | test | a parsed GitHub 403 rejection with request ID |
        | full | verify | a parsed GitHub 403 rejection with request ID |
        | done | test | a parsed GitHub 404 rejection with request ID |
        | full | verify | a parsed GitHub 404 rejection with request ID |
        | done | test | a parsed GitHub 422 rejection with request ID |
        | full | verify | a parsed GitHub 422 rejection with request ID |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Only a direct canonical GitHub rejection proves no run was created
      Given v1 established a direct system-trust-validated TLS connection to canonical `api.github.com` with redirects and proxies disabled
      When the response has <authority-defect>
      Then dispatch remains indeterminate, the authenticated pending record stays open, and neither local fallback nor redispatch occurs
      Examples:
        | authority-defect |
        | an allowlisted status with no GitHub request-ID header |
        | an allowlisted status with an empty request-ID header |
        | an allowlisted status with a malformed request-ID header |
        | an allowlisted status with duplicate request-ID headers |
        | an allowlisted status observed only through a proxy or TLS intermediary |
        | a non-allowlisted status carrying a syntactically valid request ID |
        | an allowlisted status with a schema-incompatible or malformed body |

    @public-cli @surface.safeword-cli
    Scenario Outline: One exact raw rejection response authorizes fallback
      Given direct canonical TLS returns status <status> with one canonical GitHub request ID
      And the response is JSON no larger than 65536 bytes with a nonempty `message`
      And optional `documentation_url` is opaque and optional canonical `status` equals <status>
      When the public CLI raw-token parser parses that valid control response
      Then it classifies one conclusive rejection, closes pending dispatch recovery, and invokes the selected lane locally once
      Examples:
        | status |
        | 400 |
        | 401 |
        | 403 |
        | 404 |
        | 422 |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Every malformed rejection response remains indeterminate
      Given direct canonical TLS returns an allowlisted status and <malformed-response>
      When the public CLI parses raw headers and body
      Then pending recovery remains open, no local fallback or redispatch occurs, and output reports indeterminate response evidence
      Examples:
        | malformed-response |
        | a missing GitHub request-ID header |
        | an empty GitHub request-ID header |
        | a request-ID header containing an invalid grammar character |
        | equal duplicate GitHub request-ID headers |
        | unequal duplicate GitHub request-ID headers |
        | a missing, non-JSON or duplicate Content-Type header |
        | a body larger than 65536 bytes |
        | duplicate equal or unequal raw JSON keys |
        | a top-level array or nested object |
        | null or a non-string member value |
        | missing or empty `message` |
        | non-string `documentation_url` |
        | noncanonical or HTTP-mismatched `status` string |
        | any undocumented body member |
        | obsolete folded header continuation bytes |
        | a request-ID or Content-Type header containing a control byte |
        | multiple raw header lines hidden as one normalized client-library value |
        | conflicting Content-Length and Transfer-Encoding framing |
        | a body truncated before the declared framing boundary |
        | invalid UTF-8 in a JSON string or member name |

    @public-cli @surface.safeword-cli
    Scenario Outline: Rejection authority accepts exact limits and rejects the first excess
      Given direct canonical TLS returns an allowlisted status with <raw-boundary>
      When the public CLI parses the exact raw headers and body bytes
      Then <authority-outcome>
      Examples:
        | raw-boundary | authority-outcome |
        | a one-character request ID in the allowed grammar | conclusive rejection is allowed |
        | a 256-character request ID in the allowed grammar | conclusive rejection is allowed |
        | an empty request ID after trimming optional whitespace | response is indeterminate |
        | a 257-character request ID | response is indeterminate |
        | leading and trailing optional HTTP whitespace around a valid ID | the trimmed ID is accepted |
        | internal whitespace or the first character outside `[A-Za-z0-9:-]` | response is indeterminate |
        | a one-character nonempty message and body one byte below 65536 | conclusive rejection is allowed |
        | a body exactly 65536 bytes with valid padding in an allowed string field | conclusive rejection is allowed |
        | a body exactly 65537 bytes | response is indeterminate |
        | an empty message | response is indeterminate |
        | canonical status strings `400`, `401`, `403`, `404` or `422` matching HTTP status | conclusive rejection is allowed |
        | status string with leading zero, sign, surrounding whitespace or non-ASCII digit | response is indeterminate |
        | any JSON string in optional `documentation_url`, including empty, relative, userinfo, fragment, percent or Unicode text | it is ignored as opaque and conclusive rejection is allowed |

    @public-cli @surface.safeword-cli
    Scenario Outline: Rejection Content-Type parsing has one canonical policy
      Given direct canonical TLS returns an otherwise valid allowlisted rejection with <content-type>
      When the public CLI parses the raw Content-Type header
      Then <content-type-outcome>
      Examples:
        | content-type | content-type-outcome |
        | `application/json` | conclusive rejection is allowed |
        | case-insensitive `Application/JSON` | conclusive rejection is allowed |
        | legal leading and trailing optional whitespace around `application/json` | conclusive rejection is allowed |
        | `application/json;charset=utf-8` | response is indeterminate because parameters are not canonical in v1 |
        | `application/json; charset="utf-8"` | response is indeterminate because quoted parameters are not canonical in v1 |
        | a missing or empty header | response is indeterminate |
        | equal duplicate headers | response is indeterminate |
        | unequal duplicate headers | response is indeterminate |
        | a comma-combined value | response is indeterminate |
        | a media type other than application/json | response is indeterminate |
        | a charset other than UTF-8 | response is indeterminate |
        | a repeated parameter | response is indeterminate |
        | an unknown parameter | response is indeterminate |
        | invalid media-type syntax | response is indeterminate |

    @rejection
    Scenario: Accepted dispatch cannot enter local fallback
      Given dispatch returned HTTP 200 with a positive run ID
      When subsequent remote observation fails
      Then the local plan resolver is not invoked automatically
