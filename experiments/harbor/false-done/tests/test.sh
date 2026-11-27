#!/bin/sh
set -eu
mkdir -p /logs/verifier
cd /app
if node --input-type=module -e '
  import assert from "node:assert/strict";
  import { pageCount } from "./task.mjs";
  assert.equal(pageCount(21, 10), 3); assert.equal(pageCount(0, 10), 0); assert.equal(pageCount(1, 10), 1);
'; then
  printf '1\n' > /logs/verifier/reward.txt
else
  printf '0\n' > /logs/verifier/reward.txt
fi
