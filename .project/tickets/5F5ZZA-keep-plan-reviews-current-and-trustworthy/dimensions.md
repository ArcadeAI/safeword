# Dimensions: Keep plan reviews current and trustworthy

| Dimension | Partitions and boundaries |
| --- | --- |
| Contract identity | exact bytes; edited bytes with same version; missing generated copy |
| Context resolution | configured current source; installed fallback; blank, unreadable, or stale override |
| Invalidation | semantic scope or Rule change; plan change; formatting-only plan change; normalized Execution Plan checklist progress; unrelated inventory change |
| Reviewer route | independent success; independent routes pending; typed exhaustion; best-available fallback |
| Trust boundary | public evidence; private code or credentials; retrieved code; licensed reused material |
| Surface authority | enforced local gate; applicable cloud gate; advisory-only instructions |
| Approval boundary | right behavior; accepted design; startable delivery; implemented; verified; human-approved; merge-authorized |
| Contract shape | purpose; entry; required content; prohibited content; review question; approval meaning; invalidation; return path |
| Finding authority | accepted defect; unresolved choice; optional strengthening; reviewer-authored scope or architecture |
| Accepted boundary | ticket scope; ticket exclusion; project non-goal; milestone non-goal; inherited parent boundary |
| Product Plan completeness | persona success; refusal; failure; approval; trust; recovery; explicit inapplicability; fact; assumption; unresolved decision |

## Named lower-level proof and ownership

| Accepted variation | Proof and boundary | Limit |
| --- | --- | --- |
| Referenced versus unrelated persona/surface entries | `packages/cli/tests/review/scenario-role-selected-parent.test.ts` pairs unreferenced/current with referenced/stale for personas and surfaces, including Product Bet personas; `product-role-selected-parent.test.ts` pairs selected/unselected parent boundaries. Public durable identity is exercised by `tests/integration/planning-role-review-identity.test.ts`. | Parser/projection and public CLI mechanics; not live reviewer judgment. |
| Complete required role inventories | `packages/cli/tests/review/product-role-context.test.ts`, `scenario-role-context.test.ts` and `planning-role-record.test.ts` check complete present/absent role sets. Installed Product and scenario context suites pair complete packets with named missing-source refusals before reviewer execution. | Individual roles and conditions are asserted by their named tests; no claim that every broad entry-inventory combination is executed. |
| Release-copy integrity and regeneration recovery | Existing #5041 delivery task `3J7TGR-deliver-5041-planning-contracts`, merged in #5957, owns this proof. `packages/cli/tests/claude-plugin-release.release.test.ts` executes `check-claude-plugin-release.ts`; `codex-plugin-catalogue.release.test.ts` rejects missing phase material and unexpected generated drift. `check-generated-surfaces.ts` checks the canonical generated copies and prints the matching regeneration commands. | This is inherited release-gate ownership, not a new #5051 release qualification or a completed broad acceptance claim. |
