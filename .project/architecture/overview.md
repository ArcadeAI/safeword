# Overview

## Tech Stack

The CLI runs under Bun and ships the ESLint presets. The separately deployed relay uses Node’s built-in SQLite driver so deploying it requires no native npm addon. See the [relay manifest](../../packages/retro-relay/package.json) for supported Node versions and the [pack registry](../../packages/cli/src/packs/registry.ts) for supported languages.
