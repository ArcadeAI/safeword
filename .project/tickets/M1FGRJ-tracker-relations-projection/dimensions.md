# Dimensions: sync-tracker v2 graph projection

| Dimension | Partitions | Notes |
| --- | --- | --- |
| Parent source | `parent:` resolves, `epic:` resolves, neither resolves | Native hierarchy is attempted only for known local tickets. |
| Projection order | parent ID sorts before child, child ID sorts before parent | Parent-before-child ordering must be independent of ID sort. |
| Relation source | `depends_on`, `blocked_on`, dangling relation | Known refs become native relations; dangling refs are skipped. |
| Sync action | create, update, pending-entry reconcile | Graph projection must run in every idempotent path. |
| Native type support | provider accepts type, provider rejects/omits type | The `type:<type>` label remains the fallback. |
| Provider | GitHub, Linear | Tests mock provider ports; no live tracker dependency. |

