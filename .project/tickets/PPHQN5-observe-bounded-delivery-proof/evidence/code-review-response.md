# Implementation review response

Code review 2acbf3d4 requested changes with cross-agent assurance. Its error was
a non-discriminating same-name/wrong-file unit fixture. The corrected fixture
keeps all fixed files present and moves the assertion between them. The failed
suite fixture likewise now changes an existing fixed file, so neither test can
pass solely through a file-set rejection. Both corrected controls pass against
the existing grader; no original delivery assertion was changed.

Additional real RED controls now expose the recorded-tool path mismatch,
locale-dependent canonical key order, unbound h1 content after Work Log,
incorrect exemption of fenced Work Log examples, and unnamed incomplete START
publication. The focused run reports five failures and 30 passes. Real source,
Claude-bundle and Codex-bundle startup checks each expose an owned temporary
directory leak on an unborn candidate. These are new observer defects.

The frontmatter warning is already covered by the existing shared parser:
utils/ticket-metadata.ts uses YAML uniqueKeys and rejects document errors.
New duplicate/malformed controls pass. That shared parser remains unmodified.

The separate dependency-prerequisite matrix finally ran after the global test
lock became available: four intended failures and two passing controls. The
earlier exit-75 wait started no test and earns no RED credit.

Source/profile identity, audit-output applicability, installed distributions and
the remaining acceptance/matrix obligations still need their final evidence.
This intermediate review is not approval or completion. The historical RED
gaps, original ledgers, and all 33 deferrals remain unchanged.
