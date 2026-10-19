# Independent review and responses

Intake approved: ac193ff8-d56d-4817-a3ca-575bac1c73d6. Code approved by
cross-agent Claude/Opus review d1dc47ac-5085-4ae6-ba43-97019dfdcb55 through the
unmodified installed 1.1.0 coordinator. It reviewed all changed source and tests,
plus the exact added architecture prose as a separate artifact. The existing
ARCHITECTURE.md exceeds the coordinator's whole-file cap; this is excerpt review,
not authenticated whole-file coverage. No exception is asserted for that file.

- Hostile configuration warning: added a real-repository regression planting
  diff.external, a textconv driver, clean/smudge filters and core.attributesFile.
  The expected displayed version edit must remain visible and no driver may run.
- Quoted path warning: a direct real-Git probe passed spaces, Unicode, quotes,
  tab, backspace and form-feed directory names without changing production code.
  Added those six integration cases as durable characterization coverage.
- Baseline staleness warning: intentional, already documented in the architecture
  decision and ticket. It is the resolved merge-base/ref identity that matters;
  an ordinary remote fetch that leaves that identity unchanged does not stale a
  review. A changed baseline requires a fresh review even for an identical patch.
  Existing REVIEW_STALE recovery already supplies the exact rerun command.
- Prompt identity note: generated native runtimes were regenerated in package
  context; all five generated surfaces check current. The quality-review prompt
  gains representation disclosure; unrelated planning contracts remain unchanged.
- Coverage note: the original path is credited for review of its complete changed
  patch, with 20 context lines. No claim of whole-baseline review is made, and the
  reviewer must request changes if that context is insufficient.

Live external-review proof fd21fe4a-3049-4463-847b-664b34b1e227 used the actual
343,758-byte pre-release and released locks in a fresh real Git repository and
ran the new source CLI. Claude approved the original bun.lock target with empty
excluded_targets. Source CLI status revalidated approved; a subsequent source
edit changed status to stale. This is a real external review, unlike the simulated
reviewer in deterministic receipt tests. The review noted absent manifest context;
the immutable release commit's packages/cli/package.json was separately checked
and is 1.2.0. The probe does not claim a manifest review or profile upgrade.

Primary documentation checked: [Git diff](https://git-scm.com/docs/git-diff),
[Git apply](https://git-scm.com/docs/git-apply), and
[Git merge-base](https://git-scm.com/docs/git-merge-base). Git's successful apply
checks patch validity; full bytes and executable mode are checked separately to
prove completeness. No version or dependency upgrade was necessary.

Follow-up review 3344193a-dec4-47af-a063-6c5ec9034b94 approved the strengthened
tests and source. Responses to its additional non-blocking findings:

- Keep the fixed five-second Git operation bound. A real source and baseline of
  8,388,607 bytes produced a 661-byte patch; capture plus freshness took 472 ms on
  this host. Added the near-limit integration case as regression coverage. This
  observation is not a guarantee for every host; slow operations still fail closed.
- Recomputing projection on status is deliberate integrity checking. Avoid a new
  cache and invalidation mechanism without measured need; full source/baseline
  identity must remain independently revalidated on receipt use.
- Other control-byte path names may fail reconstruction safely. The supported
  common escaping cases have real-Git coverage; no arbitrary filename support is
  claimed. Metadata calls retain repository authority but do not execute drivers.
- Credential errors preserve existing plain-Error behavior; introducing a new
  public error contract is not needed for this bug fix.
- Generated identity and inventory hashes are independently checked by the
  generated-surface and release-contract commands, not a model's visual inspection.

To remove the architecture coverage gap, two padding-heavy existing tables were
converted to labeled paragraphs without changing their twelve field values.
A whitespace-normalized equality check passed for all fields; Prettier leaves
the full document at 255,598 bytes. A fresh coordinator review now includes the
original ARCHITECTURE.md target, rather than relying on the earlier excerpt.
