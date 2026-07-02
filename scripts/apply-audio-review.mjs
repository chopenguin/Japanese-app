import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();

function getArg(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function updateVoiceManifest({ voiceId, level, selectedWordIds }) {
  const manifestPath = path.join(
    projectRoot,
    `public/audio/voices/${voiceId}/manifest.json`,
  );
  const manifest = await readJson(manifestPath);
  const existingCoverage = new Set(manifest.coverage?.[level] ?? []);
  selectedWordIds.forEach((wordId) => existingCoverage.add(wordId));
  manifest.coverage = {
    ...(manifest.coverage ?? {}),
    [level]: [...existingCoverage].sort(),
  };
  manifest.generated_at = new Date().toISOString();
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const reviewPath = getArg("review");
  if (!reviewPath) {
    throw new Error("Missing --review <path>");
  }

  const review = await readJson(path.join(projectRoot, reviewPath));
  const voiceId = review.voice_id;
  const level = review.level;
  const finalDir = path.join(projectRoot, `public/audio/voices/${voiceId}/${level}`);
  await mkdir(finalDir, { recursive: true });

  const selectedWordIds = [];
  for (const result of review.results) {
    if (result.status !== "pass") continue;
    const selected = result.candidates.find(
      (candidate) => candidate.source === result.selected,
    );
    if (!selected) continue;

    await copyFile(
      path.join(projectRoot, selected.file),
      path.join(finalDir, `${result.word_id}.wav`),
    );
    selectedWordIds.push(result.word_id);
    console.log(`apply ${result.word_id} ${selected.source}`);
  }

  await updateVoiceManifest({ voiceId, level, selectedWordIds });
  console.log(`applied ${selectedWordIds.length}/${review.results.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
