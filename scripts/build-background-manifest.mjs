import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const backgroundDir = path.join(root, "public", "background");
const manifestPath = path.join(backgroundDir, "manifest.json");
const audioExtensions = new Set([".mp3", ".wav", ".ogg", ".m4a"]);

function toId(file) {
  return path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function toName(file) {
  return path
    .basename(file, path.extname(file))
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const previous = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : { tracks: [] };
const previousByFile = new Map(
  (previous.tracks ?? []).map((track) => [track.file, track]),
);

const tracks = fs
  .readdirSync(backgroundDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && audioExtensions.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => {
    const existing = previousByFile.get(entry.name);
    return {
      id: existing?.id ?? toId(entry.name),
      name: existing?.name ?? toName(entry.name),
      file: entry.name,
      mood: existing?.mood ?? "背景循環",
      source: existing?.source ?? "Custom",
      license: existing?.license ?? "請自行確認授權",
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

fs.writeFileSync(
  manifestPath,
  `${JSON.stringify({ tracks }, null, 2)}\n`,
);

console.log(`background tracks: ${tracks.length}`);
