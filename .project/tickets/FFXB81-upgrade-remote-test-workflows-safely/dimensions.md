# Dimensions: Upgrade remote-test workflows safely

| Dimension | Partitions | Acceptance boundary |
| --- | --- | --- |
| Observed identity | exact released predecessor; current; customer-edited or unknown | Only exact released bytes are managed history |
| Requested lifecycle action | setup; disable | Setup upgrades; disable removes a recognized managed version |
| Historical revalidation | unchanged v1; current; concurrently edited; deleted; unreadable | Current and absence converge as success; customer-owned and unreadable states fail closed |
| Historical disable race | unchanged v1; current; concurrently edited; deleted; revalidation unreadable | Current and absence are successful terminal states; customer-owned and unreadable states fail closed |
| Publication failure | private preparation fails; rename fails | The complete released v1 remains and this invocation's residue is removed |
| Upgrade interruption | private preparation fails; concurrent read during atomic publication; foreign residue exists | The visible workflow is complete old or complete new bytes; invocation residue is removed and foreign residue is untouched |
| Checkout line endings | LF; CRLF | Ordinary conversion does not change identity |

Exhaustive filesystem error codes and impossible post-success rename failures
remain lower-level lifecycle concerns; the feature examples cover every
user-visible ownership, normalization, interruption, and recovery outcome.
Already-current setup, absent disable, unsafe paths, and workflow execution in
the GitHub Actions sandbox belong to HWZZJ8's base
lifecycle contract and are not duplicated here.
