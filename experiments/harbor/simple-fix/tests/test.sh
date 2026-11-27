#!/bin/sh
set -eu
mkdir -p /logs/verifier
cd /app
if node --input-type=module -e '
  import assert from "node:assert/strict";
  import { retryLimit, timeoutMs } from "./task.mjs";
  assert.equal(retryLimit, 3); assert.equal(timeoutMs, 500);
'; then
  printf '1\n' > /logs/verifier/reward.txt
else
  printf '0\n' > /logs/verifier/reward.txt
fi
