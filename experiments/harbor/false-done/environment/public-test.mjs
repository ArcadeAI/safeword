import assert from "node:assert/strict";
import { pageCount } from "./task.mjs";
assert.equal(pageCount(20, 10), 2);
