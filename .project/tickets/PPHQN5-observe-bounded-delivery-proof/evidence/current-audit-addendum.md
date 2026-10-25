# Current dependency-audit addendum

On 2026-10-24, the repository-pinned Bun 1.3.14 audit exited 1 with 12 advisories:
3 high, 6 moderate and 3 low. Raw output is current-bun-audit-failure.log.gz. These
are advisory counts, not a claim that twelve exploits are reachable through the
observer.

The root, CLI and website manifests and bun.lock are byte-identical to
origin/main f211c4c30fdb40e7fc5f342eaf981143c750db7b. This contribution introduces
no dependency update. The findings are inherited from that dependency graph.
The current report does not list the former DOMPurify finding addressed by
PR #6109; it reports other packages. Therefore the old DOMPurify failure must not
be resurrected, and a clean current dependency audit must not be claimed either.

The high-severity findings were checked against their current primary advisory
records during this pass:

| Package in the unchanged lock | Current advisory                                                         | Advisory patch information                                           |
| ----------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| http-cache-semantics 4.2.0    | [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) | Affects through 4.2.0; the record currently lists no patched version |
| zod 4.4.3 and nested 4.6.5    | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | Affects versions before 4.6.6; patched in 4.6.6                      |
| undici 8.11.2                 | [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c) | The affected 8.x range is before 8.12.2; patched in 8.12.2           |

The report also names postcss-selector-parser, fast-uri and katex; their exact
advisory identifiers and affected ranges remain in the raw scanner output.
Runtime reachability and a reviewed remediation plan have not been established
here. Do not infer that a blanket package update is sufficient or authorized.

This remains a failed current audit and a completion limitation. Dependency
remediation is outside the accepted observer-only change, alongside independent
recovery certification, historical RED repair and paid qualification. Original
research artifacts and their integrity manifest remain unchanged as dated
evidence; this addendum records the later check instead of rewriting them.
