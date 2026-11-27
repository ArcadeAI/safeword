#!/bin/sh
set -eu
mkdir -p /logs/verifier
cd /app
if grep -Fxq 'export const unrelated = {untouched: true};' greeting.mjs \
  && grep -Eq 'formatName\(name\)' greeting.mjs \
  && node --input-type=module -e '
     import { greet } from "./greeting.mjs";
     for (const [input, expected] of [["  Alex  ", "Hello, ALEX"], ["aBc", "Hello, ABC"], ["  ", "Hello, "]]) {
       if (greet(input) !== expected) process.exit(1);
     }
   '; then
  printf '1\n' > /logs/verifier/reward.txt
else
  printf '0\n' > /logs/verifier/reward.txt
fi
