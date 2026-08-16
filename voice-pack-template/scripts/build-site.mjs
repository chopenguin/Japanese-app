import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const levels = ["N5", "N4", "N3", "N2", "N1"];
const sourceRoot = resolve(process.argv[2] || ".");
const outputRoot = resolve(process.argv[3] || "_site");
const validateOnly = process.argv.includes("--validate-only");
const manifestPath = join(sourceRoot, "manifest.json");

if (!existsSync(manifestPath)) throw new Error(`Missing ${manifestPath}`);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.id || "")) {
  throw new Error("manifest.id must contain lowercase letters, digits, and hyphens.");
}
if (!manifest.name || manifest.format !== "wav") {
  throw new Error("manifest.name is required and manifest.format must be wav.");
}

let totalBytes = 0;
let totalFiles = 0;
for (const level of levels) {
  const ids = manifest.coverage?.[level];
  if (!Array.isArray(ids)) throw new Error(`manifest.coverage.${level} is missing.`);
  for (const id of ids) {
    const wavPath = join(sourceRoot, level, `${id}.wav`);
    if (!existsSync(wavPath)) throw new Error(`Missing ${wavPath}`);
    const header = readFileSync(wavPath).subarray(0, 12).toString("ascii");
    if (!header.startsWith("RIFF") || !header.includes("WAVE")) {
      throw new Error(`Invalid RIFF/WAVE header: ${wavPath}`);
    }
    totalBytes += statSync(wavPath).size;
    totalFiles += 1;
  }
}

if (totalBytes >= 1_000_000_000) {
  throw new Error(`Pack is too large for GitHub Pages: ${totalBytes} bytes.`);
}

if (!validateOnly) {
  if (existsSync(outputRoot)) rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(outputRoot, { recursive: true });
  cpSync(manifestPath, join(outputRoot, "manifest.json"));
  for (const level of levels) {
    const sourceLevel = join(sourceRoot, level);
    if (existsSync(sourceLevel)) {
      cpSync(sourceLevel, join(outputRoot, level), { recursive: true });
    }
  }
  writeFileSync(join(outputRoot, ".nojekyll"), "", "utf8");
  writeFileSync(
    join(outputRoot, "index.json"),
    `${JSON.stringify({ ...manifest, published_files: totalFiles }, null, 2)}\n`,
    "utf8",
  );
}

console.log(
  JSON.stringify(
    {
      result: "PASS",
      id: manifest.id,
      files: totalFiles,
      bytes: totalBytes,
      output: validateOnly ? null : outputRoot,
    },
    null,
    2,
  ),
);
