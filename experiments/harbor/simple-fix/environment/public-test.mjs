import assert from "node:assert/strict";
import { retryLimit, timeoutMs } from "./task.mjs";
assert.equal(timeoutMs, 500);
