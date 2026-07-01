import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const openJlptDir = process.env.OPENJLPT_DIR ?? "/tmp/OpenJLPT";
const nihongDictDir =
  process.env.NIHONGDICT_DIR ?? "/tmp/NihongDict/NihongDict/dictionarys";

const outDir = path.join(rootDir, "data", "vocabulary");
const levels = ["N5", "N4", "N3", "N2", "N1"];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function readUInt32BE(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

function parseStarDictIndex(idxPath, dictPath) {
  const idx = fs.readFileSync(idxPath);
  const dict = fs.readFileSync(dictPath);
  const entries = new Map();
  let offset = 0;

  while (offset < idx.length) {
    const start = offset;
    while (offset < idx.length && idx[offset] !== 0) offset += 1;
    if (offset >= idx.length) break;

    const key = idx.subarray(start, offset).toString("utf8");
    offset += 1;
    if (offset + 8 > idx.length) break;

    const dataOffset = readUInt32BE(idx, offset);
    const dataLength = readUInt32BE(idx, offset + 4);
    offset += 8;

    const match = key.match(/^(.*?) \[(.*?)\]$/);
    if (!match) continue;

    const word = match[1];
    const reading = match[2];
    const meaning = dict
      .subarray(dataOffset, dataOffset + dataLength)
      .toString("utf8")
      .replace(/\r?\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!meaning) continue;

    const keys = new Set([word, `${word}|${reading}`]);
    if (word === reading) keys.add(`${reading}|`);

    for (const entryKey of keys) {
      if (!entries.has(entryKey)) entries.set(entryKey, []);
      entries.get(entryKey).push(meaning);
    }
  }

  return entries;
}

function splitChineseMeanings(value) {
  return value
    .split(/[，,；;、]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

function findChineseMeanings(index, word, reading) {
  const candidates = [
    `${word}|${reading}`,
    word,
    reading ? `${reading}|${reading}` : "",
    reading,
  ].filter(Boolean);

  for (const key of candidates) {
    const meanings = index.get(key);
    if (meanings?.length) {
      return splitChineseMeanings(meanings[0]);
    }
  }

  return [];
}

function safeFolderName(index, word, reading) {
  const label = word || reading;
  const cleaned = label
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return `${String(index + 1).padStart(4, "0")}_${cleaned}`;
}

function hasKanji(value) {
  return /[\u3400-\u9fff]/u.test(value);
}

function normalizeEntry(raw, level, index, chineseIndex) {
  const kana = raw.reading || raw.word;
  const kanji = hasKanji(raw.word) ? raw.word : "";
  const chineseMeanings = findChineseMeanings(chineseIndex, raw.word, kana);

  return {
    id: `${level.toLowerCase()}-${String(index + 1).padStart(4, "0")}`,
    jlpt: level,
    kanji,
    kana,
    display: raw.word,
    meanings_zh: chineseMeanings,
    meanings_en: raw.meanings,
    audio: {
      status: "pending",
      files: [],
    },
    examples: raw.examples ?? [],
    source: {
      jlpt_and_reading: "OpenJLPT",
      chinese_meaning: chineseMeanings.length ? "NihongDict" : "missing",
    },
    review: {
      zh_meaning_checked: false,
      kana_checked: true,
    },
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const chineseIndex = parseStarDictIndex(
  path.join(nihongDictDir, "Japanese_Chinese.idx"),
  path.join(nihongDictDir, "Japanese_Chinese.dict"),
);

cleanDir(outDir);

const manifest = {
  generated_at: new Date().toISOString(),
  schema_version: 1,
  levels: {},
};

for (const level of levels) {
  const sourcePath = path.join(
    openJlptDir,
    "data",
    "json",
    "vocab",
    `${level.toLowerCase()}.json`,
  );
  const sourceEntries = readJson(sourcePath);
  const levelDir = path.join(outDir, level);
  fs.mkdirSync(levelDir, { recursive: true });

  const levelItems = [];
  let matchedChinese = 0;

  sourceEntries.forEach((raw, index) => {
    const entry = normalizeEntry(raw, level, index, chineseIndex);
    if (entry.meanings_zh.length) matchedChinese += 1;

    const folder = safeFolderName(index, raw.word, entry.kana);
    const entryDir = path.join(levelDir, folder);
    fs.mkdirSync(entryDir, { recursive: true });
    writeJson(path.join(entryDir, "entry.json"), entry);

    levelItems.push({
      id: entry.id,
      folder: `${level}/${folder}`,
      display: entry.display,
      kanji: entry.kanji,
      kana: entry.kana,
      meanings_zh: entry.meanings_zh,
    });
  });

  manifest.levels[level] = {
    count: sourceEntries.length,
    chinese_meaning_matches: matchedChinese,
    items: levelItems,
  };
}

writeJson(path.join(outDir, "manifest.json"), manifest);

const totals = Object.values(manifest.levels).reduce(
  (acc, level) => {
    acc.count += level.count;
    acc.chinese_meaning_matches += level.chinese_meaning_matches;
    return acc;
  },
  { count: 0, chinese_meaning_matches: 0 },
);

console.log(
  `Built ${totals.count} vocabulary entries. Chinese meanings matched: ${totals.chinese_meaning_matches}.`,
);
