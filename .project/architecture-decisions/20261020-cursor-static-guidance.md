# Preserve automatic Cursor guidance while selecting native delivery safely

**Status:** Proposed, 2026-10-20; ticket 2ENRH5.
**Supersedes:** the dynamic wrapper-origin detail in
[shared host contracts](./shared-host-contracts.md).

## Evidence and decision

[Cursor rules](https://cursor.com/docs/rules) use static file references. The
documented workspaceOpen callback returns plugin paths; it does not execute code
inside markdown or disable project rule/command registrations. Do not replace
host-loaded guidance with instructions asking the agent to run a resolver.

Native IDE 3.24.18 visibility control in isolated catalogue-pE45oA registered a
fresh portable test package with visibility-positive (user-invocable: true) and
visibility-negative (false). Both appeared in the actual slash menu after the
workspaceOpen callback loaded that new path. The CLI changelog's model-only
visibility setting is therefore not an applicable IDE suppression mechanism.
No test profile trust or regular user profile was changed.

Keep legacy/Cloud static project references unchanged. Their generated content
derives from the shared renderer and remains available without the CLI resolver
or native cache. Existing competing project registrations make native delivery
ineligible; choose the separately proved legacy mechanism automatically. Local
enrollment cannot retire tracked shared wrappers. The previously excluded
project-wide retirement remains a separate authorized migration.

On a clean eligible checkout, register the portable core and only necessary
non-overlapping native facets. Native skills supply their public workflows;
native extension rules, if required, derive from canonical content/metadata and
must not register duplicate commands or independently authored workflow rules.
The actual IDE catalogue and loaded-content proof determines eligibility.

## Consequences and alternatives

This retains necessary generated compatibility files for existing projects,
while eliminating independent authoring through the same contract. It does not
claim all existing repositories become native merely because a cache exists.
Automatic selection still preserves every required guarantee. Duplicate native
and project activation is rejected; missing fallback guidance is unavailable
until actual host loading is restored, not healthy because a path was returned.

Agent-mediated replacement would weaken legacy guidance loading. Rewriting
tracked wrappers for a local profile would break other clones and Cloud. No
documented native per-profile project-rule suppression was established.

## Proof and reassessment

Observe actual canonical content loading on both exact legacy IDE versions with
native cache and CLI resolver absent; preserve tracked bytes across two clones
and the cloud-like regression. Separately prove the native clean-project
catalogue, package origins, guards and continuation. Native failure must not
inherit a legacy claim until its own activation and loaded guidance are proved.
Reassess when Cursor offers an exact-target native suppression/resolution API
or a separately authorized project-wide migration can retire compatibility.
