import { mkdir, readFile, readdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const defaultEndpoint = "http://127.0.0.1:50021";
const defaultWhisperBin = "/tmp/whisper-cpp/whisper-bin-ubuntu-x64/whisper-cli";
const defaultWhisperModel = "/tmp/whisper-models/ggml-tiny.bin";
const defaultWhisperLibs = [
  "/tmp/whisper-deps/usr/lib/x86_64-linux-gnu",
  "/tmp/whisper-cpp/whisper-bin-ubuntu-x64",
];

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

function normalizeJapanese(value) {
  const normalized = String(value)
    .normalize("NFKC")
    .replace(/[、。！？!?・\s"'「」『』（）()［］\[\]]/g, "")
    .toLowerCase();

  return Array.from(normalized)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0x30a1 && code <= 0x30f6) {
        return String.fromCharCode(code - 0x60);
      }
      return char;
    })
    .join("");
}

function levenshtein(a, b) {
  const left = Array.from(a);
  const right = Array.from(b);
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      current[rightIndex + 1] =
        left[leftIndex] === right[rightIndex]
          ? previous[rightIndex]
          : Math.min(
              previous[rightIndex] + 1,
              current[rightIndex] + 1,
              previous[rightIndex + 1] + 1,
            );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function scoreTranscript(transcript, aliases) {
  const normalizedTranscript = normalizeJapanese(transcript);
  if (!normalizedTranscript) return 0;

  return Math.max(
    ...aliases.map((alias) => {
      const normalizedAlias = normalizeJapanese(alias);
      if (!normalizedAlias) return 0;
      if (normalizedTranscript === normalizedAlias) return 1;
      if (
        normalizedTranscript.includes(normalizedAlias) ||
        normalizedAlias.includes(normalizedTranscript)
      ) {
        return 0.9;
      }

      const maxLength = Math.max(
        Array.from(normalizedTranscript).length,
        Array.from(normalizedAlias).length,
      );
      if (maxLength === 0) return 0;
      return 1 - levenshtein(normalizedTranscript, normalizedAlias) / maxLength;
    }),
  );
}

function getCandidateTexts(word) {
  const display = word.kanji || word.display;
  const candidates = [];
  if (display) candidates.push({ source: "display", text: display });
  if (word.kana && word.kana !== display) {
    candidates.push({ source: "kana", text: word.kana });
  }
  if (candidates.length === 0) candidates.push({ source: "display", text: word.display });
  return candidates;
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

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited with ${code}\n${stderr}`));
    });
  });
}

async function transcribe({ whisperBin, whisperModel, audioPath }) {
  const env = {
    ...process.env,
    LD_LIBRARY_PATH: [
      ...defaultWhisperLibs,
      process.env.LD_LIBRARY_PATH ?? "",
    ]
      .filter(Boolean)
      .join(":"),
  };
  const { stdout } = await run(
    whisperBin,
    ["-m", whisperModel, "-f", audioPath, "-l", "ja", "-nt", "-np"],
    { env },
  );

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("load_backend") && !line.startsWith("read_audio_data"))
    .join("");
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
  const endpoint = getArg("endpoint", defaultEndpoint);
  const voiceId = getArg("voice", "voicevox-female");
  const speaker = Number(getArg("speaker", "2"));
  const level = normalizeLevel(getArg("level", "N5"));
  const stageNumber = Number(getArg("stage", "1"));
  const limit = Number(getArg("limit", "0"));
  const threshold = Number(getArg("threshold", "0.85"));
  const apply = hasArg("apply");
  const whisperBin = getArg("whisper-bin", defaultWhisperBin);
  const whisperModel = getArg("whisper-model", defaultWhisperModel);

  const vocabularyManifest = await readJson(
    path.join(projectRoot, "data/vocabulary/manifest.json"),
  );
  const stageData = await readJson(path.join(projectRoot, "data/stages/stages.json"));
  const words = getWordsForStage(stageData, vocabularyManifest, level, stageNumber).slice(
    0,
    limit > 0 ? limit : undefined,
  );

  const reviewDir = path.join(
    projectRoot,
    `tmp/audio-review/${voiceId}/${level}/stage-${String(stageNumber).padStart(3, "0")}`,
  );
  const finalDir = path.join(projectRoot, `public/audio/voices/${voiceId}/${level}`);
  await mkdir(reviewDir, { recursive: true });
  await mkdir(finalDir, { recursive: true });

  const results = [];
  for (const word of words) {
    const aliases = [word.display, word.kanji, word.kana].filter(Boolean);
    const candidates = [];

    for (const candidate of getCandidateTexts(word)) {
      const audioPath = path.join(reviewDir, `${word.id}.${candidate.source}.wav`);
      console.log(`tts ${word.id} ${candidate.source}: ${candidate.text}`);
      const audio = await synthesize({
        endpoint,
        speaker,
        text: candidate.text,
      });
      await writeFile(audioPath, audio);

      console.log(`asr ${word.id} ${candidate.source}`);
      const transcript = await transcribe({ whisperBin, whisperModel, audioPath });
      const score = scoreTranscript(transcript, aliases);
      candidates.push({
        source: candidate.source,
        text: candidate.text,
        file: path.relative(projectRoot, audioPath),
        transcript,
        score: Number(score.toFixed(3)),
        status: score >= threshold ? "pass" : "review",
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const selected = candidates[0];
    const status = selected.score >= threshold ? "pass" : "review";
    if (apply && selected) {
      await copyFile(
        path.join(projectRoot, selected.file),
        path.join(finalDir, `${word.id}.wav`),
      );
    }

    results.push({
      word_id: word.id,
      display: word.display,
      kanji: word.kanji,
      kana: word.kana,
      meanings_zh: word.meanings_zh,
      status,
      selected: selected?.source ?? null,
      candidates,
    });
  }

  const selectedWordIds = results
    .filter((result) => result.status === "pass")
    .map((result) => result.word_id);
  if (apply) await updateVoiceManifest({ voiceId, level, selectedWordIds });

  const summary = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    voice_id: voiceId,
    engine: "VOICEVOX",
    speaker,
    asr: {
      engine: "whisper.cpp",
      model: whisperModel,
      threshold,
    },
    level,
    stage: stageNumber,
    applied: apply,
    counts: {
      total: results.length,
      pass: results.filter((result) => result.status === "pass").length,
      review: results.filter((result) => result.status === "review").length,
    },
    results,
  };

  const reviewPath = path.join(reviewDir, "review.json");
  await writeFile(reviewPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`review ${path.relative(projectRoot, reviewPath)}`);
  console.log(`pass ${summary.counts.pass}/${summary.counts.total}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
