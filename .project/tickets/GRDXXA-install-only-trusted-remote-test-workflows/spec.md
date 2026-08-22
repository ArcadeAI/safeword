# Spec: Install only a trusted remote-test workflow

## Intent

Ensure the exact workflow Safeword ships is useful, manually triggered, and
least-privilege before its bytes become an installable managed identity.

## Rule

### TBU1.R1 — The shipped workflow grants only the authority required for explicitly requested tests

Release validation parses the exact bundled workflow and requires:

- `workflow_dispatch` is the only trigger;
- top-level permissions are exactly `contents: read`, with no job override;
- every remote action or reusable workflow uses a full lowercase commit SHA;
- local-action and `docker://` references are rejected;
- checkout sets `persist-credentials: false`;
- no secret declaration or `${{ secrets.* }}` expression exists;
- the workflow has exactly one test job, exactly the registered pre-check and
  checkout remote dependencies, and exactly the registered steps culminating in
  Safeword's full test lane; and
- the packaged bytes, schema template, and HWZZJ8 current ownership identity are
  byte-identical to the source template.

The validator is release-only and accepts no customer workflow. Runtime setup
installs only the already-admitted bundled bytes, so Safeword does not ship a
general YAML policy engine or a production mutation registry.

## Proof Strategy

One positive test parses the real bundled artifact and asserts every property.
A compact table of one-change negative fixtures proves each guard can fail:
automatic trigger, excess permission, mutable dependency, persisted checkout
credential, secret flow, wrong test command, and packaged-byte mismatch. Parser
boundary tests cover duplicate keys, aliases/merges, multiple documents, and
non-mapping nodes because those forms could obscure the asserted structure.

The negative table is a regression set, not a claim to enumerate every YAML
document. Semantic admission decides whether workflow bytes are safe;
distribution identity ensures every shipped consumer uses those same admitted
bytes. Intentional coordinated changes remain ordinary reviewed source changes,
not a condition a redundant checked-in digest could independently authorize.

## Boundary

HWZZJ8 owns local installation and customer-byte preservation. S2TF4J owns
dispatch and result handling. BR373S owns runtime input and remote-result trust.

## Open Questions

None.
