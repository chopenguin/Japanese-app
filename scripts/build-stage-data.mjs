import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, "data", "vocabulary", "manifest.json");
const outDir = path.join(rootDir, "data", "stages");
const outPath = path.join(outDir, "stages.json");
const levels = ["N5", "N4", "N3", "N2", "N1"];
const wordsPerStage = 10;

function hashSeed(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return () => {
    let next = (seed += 0x6d2b79f5);
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, seed) {
  const random = mulberry32(hashSeed(seed));
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const stageManifest = {
  generated_at: new Date().toISOString(),
  schema_version: 1,
  seed: "japanese-app-stage-v1",
  words_per_stage: wordsPerStage,
  levels: {},
};

for (const level of levels) {
  const wordIds = manifest.levels[level].items.map((item) => item.id);
  const shuffled = shuffle(wordIds, `${stageManifest.seed}:${level}`);
  const stages = [];

  for (let index = 0; index < shuffled.length; index += wordsPerStage) {
    stages.push({
      id: `${level.toLowerCase()}-${String(stages.length + 1).padStart(3, "0")}`,
      number: stages.length + 1,
      word_ids: shuffled.slice(index, index + wordsPerStage),
    });
  }

  stageManifest.levels[level] = {
    count: stages.length,
    stages,
  };
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(stageManifest, null, 2)}\n`, "utf8");
console.log(`Built stage data at ${outPath}`);
