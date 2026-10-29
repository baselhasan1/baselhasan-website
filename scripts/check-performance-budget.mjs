import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const root = join(import.meta.dirname, "..");
const html = readFileSync(join(root, "dist", "index.html"), "utf8");
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((match) => match[1]);
const limit = 150 * 1024;
let total = 0;

for (const source of scripts) {
  const path = join(root, "dist", source.replace(/^\//, ""));
  const raw = readFileSync(path);
  const gzip = gzipSync(raw).byteLength;
  total += gzip;
  console.log(`${source}: ${(gzip / 1024).toFixed(1)} KiB gzip (${(statSync(path).size / 1024).toFixed(1)} KiB raw)`);
}

console.log(`Initial JavaScript: ${(total / 1024).toFixed(1)} KiB gzip / ${(limit / 1024).toFixed(0)} KiB budget`);
if (total > limit) process.exitCode = 1;
