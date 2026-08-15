import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { acquireRunLock } from "./scored-case-store";

const [outputRoot, contenderId] = process.argv.slice(2);
if (!outputRoot || !contenderId) throw new Error("output root and contender ID required");
writeFileSync(join(outputRoot, `ready-${contenderId}`), "ready\n");
while (true) {
	const ready = new Bun.Glob("ready-*");
	if ([...ready.scanSync(outputRoot)].length >= 2) break;
	await Bun.sleep(5);
}

try {
	const lock = acquireRunLock(outputRoot);
	writeFileSync(join(outputRoot, `acquired-${contenderId}`), "acquired\n");
	await Bun.sleep(500);
	lock.release();
} catch {
	process.exitCode = 2;
}
