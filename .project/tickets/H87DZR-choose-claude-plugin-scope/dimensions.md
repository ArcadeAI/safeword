# Dimensions: Choose where Safeword runs in Claude

| Dimension | Partitions and boundaries | Rules |
| --- | --- | --- |
| Requested scope | omitted · explicit project · explicit user · unsupported local or malformed | TBU1.R1 |
| Selected-scope state | absent · exact enabled · disabled · older official · malformed or newer official | TBU1.R1, TBU1.R2, TBU1.R3 |
| Other-scope state | absent · exact · older · disabled · unrelated third-party state | TBU1.R2, NTB1.R1 |
| Project identity | current repository · another repository · no applicable project entry | NTB1.R1 |
| Mutation boundary | project declaration and shared cache · profile declaration and shared cache · unrelated project/profile bytes | TBU1.R2 |
| Repetition | first convergence · exact rerun | TBU1.R3 |
| Applicable installation | project only · user fallback · neither · both | NTB1.R1 |
| Overlap health | same exact version · divergent version · disabled or unhealthy entry | NTB1.R1, NTB1.R2 |
| Cleanup authority | one applicable proven scope · overlapping scopes · proof for another project · missing or stale proof | NTB1.R2 |
| Failure timing | preflight · marketplace mutation · plugin mutation · postcondition observation | TBU1.R2 |

## Boundary decisions

- Project scope is the default, but explicitly requesting project scope has the
  same terminal state.
- Project scope controls repository declaration and activation; Claude's
  physical marketplace and plugin cache remains profile-local shared state.
- A project-scoped entry applies only when its `projectPath` identifies the
  current repository. Another repository's entry cannot shadow a valid user
  installation.
- Selecting one scope never silently removes, disables, upgrades, or rewrites
  an installation in the other scope.
- Overlap is action-required even when both entries are healthy because one
  cache execution cannot prove which declaration supplied authority.
- Cleanup accepts either scope when it is the sole applicable exact installation
  and refuses overlap before removing legacy protection.
