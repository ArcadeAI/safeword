# Independent review responses

Implementation review `2a40111c-1035-4eff-a7f0-376f8d4da248`: actual reviewer
Claude, model `opus`, author Codex, cross-agent independence, approved with no
errors. Four non-blocking findings are retained and answered:

1. Advisory fallback means **no available checker candidates**, including no
   pinned package route. An installed version normally supplies such a route;
   offline/unavailable checkers therefore refuse use. The old receipt routes
   also included pinned package fallback. Main's shared resolver permits 30s
   for a first package download; host timeout/native availability is not proven
   by this change. This is an explicit limitation, not a copy-mismatch verdict.
2. A non-Cursor hook launched using a project-owned runtime can have no trusted
   candidates and take the advisory path. The host launcher is inside the
   accepted trusted boundary; broadening host-bootstrap enforcement is deferred.
3. Project-owned CODEX_HOME remains a fail-closed refusal, even with an otherwise
   trusted plugin route. This is conservative availability behavior. Keep the
   existing project-owned-cache refusal test and require an external cache root;
   relaxing the refusal or changing main's resolver is outside this integration.
4. The new PATH test proves the installed **shared hook** under a trusted
   launcher. It does not prove the outer Cursor adapter's bootstrap. That
   adapter remains unchanged; the initial failed probe and this limitation are
   retained in integration-review.md and raw evidence.

Intake review `7fbaad23-21b3-41de-ba25-d04e276dc3f0` also approved. Its warning
about dates is resolved by distinguishing the 2026-10-19 UTC admin-merge request
from the 2026-10-20 UTC delivery-partition approval. The ticket names concrete
Product/hook tests and direct historical evidence links. Its intake phase was
reviewed and stamped before advancing; no prior phase was falsely backdated.

Final verification/source review `86233b69-aaa3-4351-a6f7-21d0814b9f6a`:
Claude/opus, cross-agent, approved with no blocking errors. Verification phase
was stamped normally through the witnessed coordinator receipt. Responses:

- Untyped/non-current responses can fall through to another trusted exact-version
  candidate; known typed copy failures remain final refusals. Keep main's shared
  fallback policy and retain its availability/host-timeout limitation rather
  than introducing another resolver or inventing a copy mismatch.
- The outer Cursor bootstrap gap now has separate local task **3DD2P0**. No
  native hostile-PATH protection is claimed by the shared-checker test.
- Legacy hosts without any candidates remain advisory; that is the accepted
  host boundary, not an implied completed enforcement proof.
- Ticket-id echoing would tighten diagnostic binding but is optional inside
  the accepted trusted-runtime boundary. Do not expand this closed CLI contract
  during a delivery integration.

Final local checks: 332/332 tests, repository ESLint/Gherkin lint/CLI typecheck,
all five generated surfaces, parity and three real CLI copy checks passed.
The successful repository lint log is retained with the targeted evidence.
