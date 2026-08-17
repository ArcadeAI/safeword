# Recovery dimensions

| Dimension | Partitions |
| --- | --- |
| Operation | setup/create; setup/update; disable |
| Destination | absent; historical; current; customer-owned; unsafe |
| Failure | create; write; sync; recheck; rename; remove; verify |
| Interruption result | old complete destination; new complete destination; owned temporary residue |
| Retry | converges; preserves customer change; rejects unknown residue |
