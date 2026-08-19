# Spec: Run the requested revision remotely with least privilege

## Intent

Make remote results trustworthy enough for ordinary customer-owned CI: run the
requested immutable revision with read-only repository access and report which
revision actually ran.

This feature assumes the customer's repository code and GitHub environment are
not malicious. It prevents accidental privilege and revision mistakes; it does
not defend a customer from their own code, maintainers, workflows, or secrets.

## Intake Brief

- **Requested by:** Alex, while simplifying optional remote testing for Safeword customers.
- **Cost of inaction:** Safeword could report a result for a different revision than the one requested, or install a workflow with broader repository authority than its test job needs.
- **Reversibility:** Customers can disable or remove the optional workflow. A shipped workflow's pinned Safeword command is a compatibility commitment and changes only through the managed workflow-upgrade path.

## References

- [Parent remote-testing contract](../BBNZ68-offload-tests-without-blocking-local-work/spec.md)
- [GitHub manual workflow dispatch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [GitHub Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)

## Product Inspiration

### GitHub Actions — make the ordinary secure path sufficient

- **Checked:** 2026-08-17.
- **Customer-value evidence:** GitHub natively supports manually dispatched workflows, explicit token permissions, immutable commit-SHA action references, and checkout without persisted credentials.
- **Principle borrowed:** Prefer the platform's small, legible safety controls over a custom trust subsystem.
- **Boundary not copied:** Organization-wide policy enforcement and hostile-code threat modeling solve a broader problem than this customer-owned, non-malicious CI lane.
- **Decision:** Keep exact target checkout, `contents: read`, immutable action pins, and `persist-credentials: false`; omit custom pre-check, cryptography, branch-race, and adversarial-code machinery.

## Personas

- Technical Builder (TBU)

## Surfaces

Affected:

- GitHub Actions Execution Sandbox

Unaffected:

- Agent runtimes — they consume the same Safeword result and add no runner authority.

## Vocabulary

- **Requested revision:** The 40-character lowercase hexadecimal commit SHA selected and recorded by Safeword before dispatch.
- **Additional remote action:** Any remote `uses:` action other than checkout. None is required by policy, but each one present must use an immutable commit SHA.
- **Safeword-provided secret:** Any `secrets:` declaration or mapping, or any
  `secrets.*` expression—including `secrets.GITHUB_TOKEN`—introduced by the
  bundled workflow. GitHub's automatic token supplied through `contents: read`
  permissions is platform-provided and needs no secret expression.

## Jobs To Be Done

### remote-runner.TBU1 — Trust which revision passed remotely

**Persona:** Technical Builder (TBU)

> When I offload tests to my repository's GitHub Actions runner, I want the job
> to test the exact revision Safeword requested with only read access, so I can
> use the result without wondering whether CI tested different code or received
> unnecessary authority.

#### remote-runner.TBU1.R1 — The remote job tests and reports the exact requested commit

#### remote-runner.TBU1.R2 — The remote job runs only the requested supported test lane

#### remote-runner.TBU1.R3 — Repository code receives only the admitted read-only authority and immutable workflow dependencies

## Rave Moment

skip: inherited from the parent epic.

## Outcomes

- A passing or failing remote result identifies the exact full commit SHA that was checked out.
- The job runs the requested `done` or `full` Safeword test lane and rejects any other lane before checkout.
- The workflow grants only `contents: read`, does not persist checkout credentials, and receives no Safeword-provided secret.

## Open Questions

None.

## Boundary

GRDXXA proves the released workflow is the admitted artifact. HWZZJ8 proves that
same artifact is installed without replacing customer-owned bytes. This ticket
proves only the admitted workflow's revision, lane, and job-authority behavior.
