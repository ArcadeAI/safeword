# Dimensions: Upgrade remote-test workflows safely

| Dimension | Partitions | Acceptance boundary |
| --- | --- | --- |
| Observed identity | exact released predecessor; current; customer-edited or unknown | Only exact released bytes are managed history |
| Requested lifecycle action | setup; disable | Setup upgrades; disable removes a recognized managed version |
| Upgrade interruption | before publication; ownership changes before replacement; atomic rename succeeds | The visible workflow is complete old or complete new bytes |
| Checkout line endings | LF; CRLF | Ordinary conversion does not change identity |

Exhaustive filesystem error codes remain lower-level lifecycle tests; the
feature examples cover the user-visible ownership and interruption outcomes.
