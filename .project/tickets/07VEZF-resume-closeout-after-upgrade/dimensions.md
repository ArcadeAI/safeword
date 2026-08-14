# Dimensions: Resume interrupted closeout after a Codex upgrade

| Dimension | Partitions |
| --- | --- |
| Repository identity | exact match; foreign repository; unreadable repository |
| Receipt lifecycle | fresh unclaimed; claimed by current task; claimed by another task; expired; malformed; completed |
| Pull-request identity | unchanged exact target; changed head; closed or absent target |
| Authority | advisory only; attempted inherited merge or cleanup authority |
| Restart boundary | old task records; new matching SessionStart claims; failed resume; successful cleanup |
