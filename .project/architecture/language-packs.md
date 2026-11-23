# Language Packs

## Pattern: Modular Language Support

Each bundled pack owns language detection, project configuration, and setup. The [pack contract](../../packages/cli/src/packs/types.ts) defines the interface. The [bundling decision](bundled-language-packs-no-external-packages.md) explains the release trade-off.

## Pack File Structure

The [registry](../../packages/cli/src/packs/registry.ts) selects packs. Packs contribute file and package definitions to the shared reconciliation schema. Each pack supplies only the operations its language needs.

## Config Schema

Project configuration tracks installed packs. Reconciliation writes the installed version to `.safeword/version`.
