#!/bin/sh
set -eu
mkdir -p /logs/verifier
cd /app
# Capture authored files for manual evidence review. Exclude installed tooling.
find . -maxdepth 4 -type f \( -name '*.mjs' -o -name '*.js' -o -name '*.ts' -o -name '*.feature' -o -name '*.json' \) \
  ! -path './node_modules/*' ! -path './.git/*' ! -path './.safeword/*' ! -path './.claude/*' \
  ! -name 'package-lock.json' -print0 | tar -czf /logs/verifier/proof.tar.gz --null -T -
if node --input-type=module -e '
  import assert from "node:assert/strict";
  import { checkout } from "./task.mjs";
  assert.equal(checkout(20, 0, false), "sold-out");
assert.equal(checkout(20, 0, true), "sold-out");
assert.equal(checkout(20, 1, false), "payment-required");
assert.equal(checkout(20, 1, true), "confirmed");
'; then
  printf '1\n' > /logs/verifier/reward.txt
else
  printf '0\n' > /logs/verifier/reward.txt
fi
