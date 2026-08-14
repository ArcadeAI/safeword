#!/usr/bin/env bash
set -euo pipefail

if [ "${GITHUB_REF:-}" != 'refs/heads/main' ] || [ -z "${BEFORE:-}" ]; then
  echo 'deploy=false' >> "$GITHUB_OUTPUT"
  exit 0
fi

if [ "$BEFORE" = '0000000000000000000000000000000000000000' ]; then
  echo 'deploy=true' >> "$GITHUB_OUTPUT"
  exit 0
fi

if ! git fetch --no-tags --depth=1 origin "$BEFORE"; then
  echo '::warning::Previous main revision is unreachable; deploying conservatively.'
  echo 'deploy=true' >> "$GITHUB_OUTPUT"
  exit 0
fi

changed_files="$(git diff --name-only "$BEFORE" "$SHA")"
deploy=false
while IFS= read -r changed; do
  case "$changed" in
    packages/retro-relay/* | packages/cli/package.json | packages/website/package.json | package.json | bun.lock | tsconfig.json | .dockerignore | railway.json | .github/workflows/deploy-retro-relay.yml | .github/workflows/ci.yml)
      deploy=true
      break
      ;;
  esac
done <<< "$changed_files"
echo "deploy=$deploy" >> "$GITHUB_OUTPUT"
