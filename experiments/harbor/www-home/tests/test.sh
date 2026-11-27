#!/bin/sh
set -eu
mkdir -p /logs/verifier /app/tests
cd /app
cp /tests/home-adoption.spec.ts tests/harbor-home.spec.ts
cp /tests/harbor-playwright.config.ts harbor-playwright.config.ts
node --input-type=module -e '
  import { chromium } from "@playwright/test";
  const browser = await chromium.launch();
  await browser.close();
'
bunx --no-install playwright test --list --config=harbor-playwright.config.ts tests/harbor-home.spec.ts
if bunx --no-install playwright test --config=harbor-playwright.config.ts tests/harbor-home.spec.ts; then
  printf '1\n' > /logs/verifier/reward.txt
else
  printf '0\n' > /logs/verifier/reward.txt
fi
