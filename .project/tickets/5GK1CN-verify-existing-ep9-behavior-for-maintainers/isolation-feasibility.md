# Local isolation feasibility and actual stopping point

Design-validation only: no CI workflow, product code, model review, qualification,
installation or closing record changed. The Docker CLI was installed but its
OrbStack engine was stopped. Starting the existing app restored Docker 29.8.2;
the probes used a cached Alpine image by content ID, with pull=never. OrbStack
remains running; no existing containers were stopped or removed.

## Results

The candidate container wrote a false success claim but exited 42. The trusted
host recorded failure from the actual process result instead of accepting that
claim. The candidate had no host Docker socket, trusted controller mount or
synthetic host-only signing environment variable. The trusted canary stayed
unchanged. All probe containers auto-removed and temporary directories deleted.

The first filesystem probe tried to write at filesystem root, which could fail
from ordinary user permissions rather than readonly isolation. This was not a
discriminating control. The corrected probe uses the world-writable /tmp path.
Both original output and corrected controls are retained, without treating the
first filesystem result as proof of readonly enforcement.

| Corrected control | Expected exit | Actual exit |
| --- | --- | --- |
| Isolated candidate falsely claims success | 42 | 42 |
| Deliberately expose synthetic environment canary | 92 | 92 |
| Deliberately expose trusted test path readonly | 91 | 91 |
| Deliberately allow writable root filesystem | 93 | 93 |
| Genuine successful command | 0 | 0 |

These controls establish a feasible local controller/container boundary, not
complete escape resistance or GitHub OIDC/attestation correctness. No real
credentials were supplied. This is not native-host or model qualification.

## Critical path

Historical authorization text below was written before ordinary paid planning
reviews were approved. Current authority permits bounded review-and-repair cycles;
implementation, CI dispatch, qualification, installation and merge remain excluded.

Do not build another verification service or expand these probes into a security
framework. The bounded design is concrete enough for its next independent
planning review. The one previously authorized review requested changes; its
findings and rejection remain preserved. The revised design is not approved.

The current permission boundary still excludes additional paid model calls,
implementation and CI dispatch. An actual GitHub validation must eventually
check the trusted workflow identity, credential separation, complete report
binding and offline verification, but cannot be represented by these local
results. Do not silently start it.

Before feature coding, corrected execution-review benchmarks also need review
and successful separately authorized qualification: no current execution-plan
reviewer is admitted against the changed corpus. Ordinary planning approval
alone does not resolve that dependency. EP9's code repairs, native walkthroughs
and historical-evidence obligations remain downstream. All 33 deferrals remain.
