# Dimensions: python-importlinter-scaffold

Derived from intake (scope, done_when, resolved questions) + domain knowledge.

| Dimension                     | Partitions                                                                                                                              | Boundaries / notes                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Package layout                | single flat package (`pkg/__init__.py` at root); single src-layout (`src/pkg/__init__.py`); zero packages (scripts only); 2+ packages | src-layout is the modern default — must work, not just flat; 2+ includes flat+src mix |
| Pre-existing config           | none; `.importlinter` file; `setup.cfg [importlinter]`; `pyproject.toml [tool.importlinter]`                                            | any of the three forms → hands off entirely (same probe set audit uses, #857)      |
| Check validity (E2E teeth)    | acyclic code → `lint-imports` exit 0; introduced sibling cycle → non-zero                                                               | proves the scaffold is *valid for the tool*, not just present                       |
| Lifecycle                     | setup creates; upgrade idempotent (no churn/duplicate); reset removes safeword-scaffolded file; reset preserves user-authored file      | user-authored preservation is the sharp edge — ownership must distinguish           |
| Install guidance              | tool absent + uv-locked → `uv add --dev`; tool absent + bare pip → `pip install`; tool already installed → no guidance line             | guidance only, never installs (pack pattern); no nag when already present           |
| Project language              | Python project → pack applies; non-Python → pack never runs                                                                             | covered by existing pack detection tests — no new scenario (protected behavior)     |
