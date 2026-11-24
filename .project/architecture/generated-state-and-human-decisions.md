# Generated State and Human Decisions

The [workspace map](../architecture.generated.md) records package membership and dependencies. Each generated package document lists its modules. It keeps the maintainer’s description for as long as the module exists and flags descriptions that need review.

## Reverse-authoring adequacy

Start with the generated inventory. Check public effects against the [command catalogue](../../packages/cli/src/cli-protocol/catalog.ts) and ownership against the [schema](../../packages/cli/src/schema.ts). Neither the inventory nor a fingerprint explains a design choice. The [overview](../../ARCHITECTURE.md) links to records explaining each choice, the alternatives, and what later replaced it.
