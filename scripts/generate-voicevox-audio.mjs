import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const defaultEndpoint = "http://127.0.0.1:50021";

function getArg(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function normalizeLevel(value) {
  const level = String(value).toUpperCase();
  if (!["N5", "N4", "N3", "N2", "N1"].includes(level)) {
    throw new Error(`Unsupported level: ${value}`);
  }
  return level;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function getWordsForStage(stageData, vocabularyManifest, level, stageNumber) {
  const stage = stageData.levels[level].stages.find(
    (item) => item.number === stageNumber,
  );
  if (!stage) throw new Error(`Stage not found: ${level} ${stageNumber}`);

  const vocabularyById = new Map(
    vocabularyManifest.levels[level].items.map((word) => [word.id, word]),
  );

  return stage.word_ids.map((wordId) => {
    const word = vocabularyById.get(wordId);
    if (!word) throw new Error(`Word not found in manifest: ${wordId}`);
    return word;
  });
}

function getWordsForLevel(vocabularyManifest, level) {
  return vocabularyManifest.levels[level].items;
}

function getWordById(vocabularyManifest, level, wordId) {
  const word = vocabularyManifest.levels[level].items.find((item) => item.id === wordId);
  if (!word) throw new Error(`Word not found in manifest: ${wordId}`);
  return word;
}

function getSynthesisText(word, textSource) {
  if (textSource === "kana") {
    return word.kana || word.kanji || word.display;
  }

  return word.display || word.kanji || word.kana;
}

async function synthesize({ endpoint, speaker, text }) {
  const queryUrl = new URL("/audio_query", endpoint);
  queryUrl.searchParams.set("speaker", String(speaker));
  queryUrl.searchParams.set("text", text);

  const queryResponse = await fetch(queryUrl, { method: "POST" });
  if (!queryResponse.ok) {
    throw new Error(`audio_query failed: ${queryResponse.status}`);
  }

  const query = await queryResponse.json();
  query.speedScale = Number(getArg("speed", "0.92"));
  query.prePhonemeLength = Number(getArg("pre-phoneme", "0.04"));
  query.postPhonemeLength = Number(getArg("post-phoneme", "0.04"));

  const synthesisUrl = new URL("/synthesis", endpoint);
  synthesisUrl.searchParams.set("speaker", String(speaker));

  const synthesisResponse = await fetch(synthesisUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!synthesisResponse.ok) {
    throw new Error(`synthesis failed: ${synthesisResponse.status}`);
  }

  return Buffer.from(await synthesisResponse.arrayBuffer());
}

async function main() {
  const endpoint = getArg("endpoint", defaultEndpoint);
  const voiceId = getArg("voice", "voicevox-female");
  const speaker = Number(getArg("speaker", "2"));
  const level = normalizeLevel(getArg("level", "N5"));
  const stageArg = getArg("stage", "1");
  const stageNumber = Number(stageArg);
  const wordId = getArg("word-id", "");
  const limit = Number(getArg("limit", "0"));
  const overwrite = hasArg("overwrite");
  const generateAll = hasArg("all") || stageArg === "all";
  const textSource = getArg("text-source", "display");
  if (!["display", "kana"].includes(textSource)) {
    throw new Error(`Unsupported text source: ${textSource}`);
  }

  const vocabularyManifest = await readJson(
    path.join(projectRoot, "data/vocabulary/manifest.json"),
  );
  const stageData = await readJson(path.join(projectRoot, "data/stages/stages.json"));
  const manifestPath = path.join(
    projectRoot,
    `public/audio/voices/${voiceId}/manifest.json`,
  );
  const voiceManifest = await readJson(manifestPath);

  const words = (
    wordId
      ? [getWordById(vocabularyManifest, level, wordId)]
      : generateAll
      ? getWordsForLevel(vocabularyManifest, level)
      : getWordsForStage(stageData, vocabularyManifest, level, stageNumber)
  ).slice(0, limit > 0 ? limit : undefined);
  const outDir = path.join(projectRoot, `public/audio/voices/${voiceId}/${level}`);
  await mkdir(outDir, { recursive: true });

  const generated = [];
  for (const [index, word] of words.entries()) {
    const outPath = path.join(outDir, `${word.id}.wav`);
    if (!overwrite) {
      try {
        await readFile(outPath);
        console.log(`skip ${index + 1}/${words.length} ${word.id}`);
        generated.push(word.id);
        continue;
      } catch {
        // Generate missing files.
      }
    }

    const text = getSynthesisText(word, textSource);
    console.log(`generate ${index + 1}/${words.length} ${level} ${word.id} ${text}`);
    const audio = await synthesize({ endpoint, speaker, text });
    await writeFile(outPath, audio);
    generated.push(word.id);
  }

  const existingCoverage = new Set(voiceManifest.coverage?.[level] ?? []);
  generated.forEach((wordId) => existingCoverage.add(wordId));
  voiceManifest.coverage = {
    ...(voiceManifest.coverage ?? {}),
    [level]: [...existingCoverage].sort(),
  };
  voiceManifest.generated_at = new Date().toISOString();
  await writeFile(manifestPath, `${JSON.stringify(voiceManifest, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
