import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function readArgument(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || !process.argv[index + 1]) return "";
  return process.argv[index + 1];
}

const id = readArgument("id");
const name = readArgument("name");
const baseUrl = readArgument("base-url").replace(/\/+$/, "");
const manifestUrl = readArgument("manifest-url") || `${baseUrl}/manifest.json`;
const catalogPath = resolve(
  readArgument("catalog") || "public/audio/voices/index.json",
);

if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  throw new Error("--id must contain only lowercase letters, digits, and hyphens.");
}
if (!name.trim()) throw new Error("--name is required.");

for (const [label, value] of [
  ["--base-url", baseUrl],
  ["--manifest-url", manifestUrl],
]) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS.`);
  }
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
if (!Array.isArray(catalog.voices)) {
  throw new Error("Voice catalog does not contain a voices array.");
}
if (catalog.voices.some((voice) => voice.id === id)) {
  throw new Error(`Voice id already exists: ${id}`);
}

catalog.voices.push({
  id,
  name: name.trim(),
  type: "audio-pack",
  manifest: manifestUrl,
  audio_base_url: baseUrl,
});

writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Registered ${id} in ${catalogPath}`);
