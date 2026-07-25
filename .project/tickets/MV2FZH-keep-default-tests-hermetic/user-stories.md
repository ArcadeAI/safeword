# User Story: Keep default tests hermetic

As a Safeword maintainer, I want the default test suite to avoid live registry installs so that local and CI verification completes reliably without external network availability.

## Acceptance criteria

- Default fixture setup passes `SAFEWORD_SKIP_INSTALL=1` unless a test explicitly opts into installation.
- Explicit caller environment values still take precedence over the default.
- The slow, explicitly networked lane remains the place for real package-manager installs.
