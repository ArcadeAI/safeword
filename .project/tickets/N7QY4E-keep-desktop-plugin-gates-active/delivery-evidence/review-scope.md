# Issue 6004 final quality review

Accepted scope: accept YAML reserialization of exposed Claude skill headers while preserving meaningful metadata, exact body bytes, and byte-exact runtime/template/older-inventory checks. Review normalization, real dispatcher/profile wiring, generated inventory contract, BDD/TDD regression discrimination, and scoped test-helper refactors. Do not invent cache discovery, signatures, new host flows, or generic metadata hardening.

Research as of prompt date 2026-10-21:

- Verified https://eemeli.org/yaml/ : YAML 2 supports parseDocument; uniqueKeys checks duplicate keys; maxAliasCount 0 rejects aliases; mapAsMap preserves mapping types. Parsing may throw and both production callers already catch verification errors.
- Verified https://github.com/eemeli/yaml/releases : latest stable 2.9.1, installed 2.9.0. Patch notes concern recursive merge aliases and quoted string unfolding. Aliases are rejected by this feature; no dependency upgrade is proposed without a demonstrated relevant defect.
- Verified https://code.claude.com/docs/en/skills : skill front matter controls tool access and invocation, so ignoring metadata is invalid. Do not infer a complete host parser equivalence contract from this page.
- Security advisories checked at https://github.com/eemeli/yaml/security/advisories ; no claim of full vulnerability absence.

R0/R1 refactors passed isolated tests before their commits. Expanded Claude BDD lane after the final scoped snapshot repair passed 104 scenarios/4986 steps. R2 duplicate diagnostic-hash optimization was reverted and deferred, not shipped. Another checkout holds the local global Vitest lock; fresh current-head full tests will run in CI before merging. Current main is being integrated with generated assets regenerated from source.

Specific questions: Can changed metadata/body/runtime pass accidentally? Are malformed YAML errors caught at both actual caller boundaries? Do exact cleanup-marker exclusions still protect other plugin/project state and assert the permitted marker separately? Are generated digests tested across every shipped skill? Report concrete failures, distinguish optional suggestions, and bound any policy warning to accepted scope.
