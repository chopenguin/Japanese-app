import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const rootDir = process.cwd();
const openJlptDir = process.env.OPENJLPT_DIR ?? "/tmp/OpenJLPT";
const nihongDictDir =
  process.env.NIHONGDICT_DIR ?? "/tmp/NihongDict/NihongDict/dictionarys";
const require = createRequire(import.meta.url);
let OpenCC;
try {
  OpenCC = require("opencc-js");
} catch {
  OpenCC = require("/tmp/opencc-work/node_modules/opencc-js");
}
const toTraditional = OpenCC.Converter({ from: "cn", to: "tw" });

const outDir = path.join(rootDir, "data", "vocabulary");
const levels = ["N5", "N4", "N3", "N2", "N1"];
const translationOverridesPath = path.join(
  outDir,
  "translation-overrides.zh-TW.json",
);
const translationOverrides = fs.existsSync(translationOverridesPath)
  ? readJson(translationOverridesPath)
  : {};
const mojibakePattern = /[偐偑偄偙偔偡偆偼偟偪偩偲偮偖偰偭偒偨偺偹傆傎傓傞傫傚僆僀僋僔僗僩僠僢僪僳僺僾儁儃儅儔儗儞乕夛奜崙悞攓堘柟梡帠慏曽摉拞彲揙揑琵嘇]/u;
const entryCorrections = {
  "N2:1793": {
    kanji: "対立",
    display: "対立",
  },
  "N2:123": {
    kana: "しいんと",
    meanings_zh: ["鴉雀無聲", "寂靜", "靜悄悄"],
    meanings_en: ["silent", "quiet", "still"],
  },
  "N2:135": {
    kana: "じゅうたん",
  },
  "N2:168": {
    kana: "だいいち",
  },
  "N2:266": {
    kana: "ミリ",
  },
  "N3:35": {
    kana: "うん",
    meanings_zh: ["嗯", "是", "對", "好"],
    meanings_en: ["yeah", "uh-huh", "yes"],
  },
  "N3:95": {
    kana: "しまい",
    meanings_zh: ["結束", "終了", "完了"],
    meanings_en: ["end", "close", "finish"],
  },
  "N3:96": {
    kana: "しまう",
  },
  "N3:97": {
    kana: "しまった",
  },
  "N3:113": {
    kana: "すみません",
  },
  "N3:127": {
    kana: "それ",
    meanings_zh: ["那個", "那件事", "它"],
    meanings_en: ["it", "that"],
  },
  "N3:151": {
    kana: "できる",
  },
  "N3:157": {
    kana: "どう",
    meanings_zh: ["如何", "怎麼樣", "以什麼方式"],
    meanings_en: ["how", "in what way"],
  },
  "N3:171": {
    kana: "とん",
  },
  "N3:181": {
    kana: "ね",
    meanings_zh: ["吧", "啊", "呀", "對吧"],
    meanings_en: ["right?", "isn't it?", "sentence-ending particle for confirmation"],
  },
  "N3:185": {
    kana: "はい",
    meanings_zh: ["是", "好的", "到"],
    meanings_en: ["yes", "okay", "present"],
  },
  "N3:203": {
    kana: "ふと",
  },
  "N3:241": {
    kana: "よろしく",
  },
  "N3:812": {
    kana: "さんせい",
  },
  "N4:535": {
    meanings_zh: ["他們", "他們那些人"],
  },
};

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
  return toTraditional(value)
    .split(/[，,；;、]/)
    .map((item) => item.trim())
    .map(cleanChineseMeaning)
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

function cleanChineseMeaning(value) {
  if (isCorruptChineseMeaning(value)) return "";

  return value
    .replace(new RegExp(`\\[[^\\]]*${mojibakePattern.source}[^\\]]*\\]`, "gu"), "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCorruptChineseMeaning(value) {
  if (value.includes("///")) return true;
  return mojibakePattern.test(value);
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

function findFallbackMeanings(raw) {
  const glossKey = raw.meanings.join("; ");
  return (translationOverrides[glossKey] ?? []).map((meaning) =>
    toTraditional(meaning),
  );
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
  let chineseMeanings = findChineseMeanings(chineseIndex, raw.word, kana);
  let hasDictionaryChinese = chineseMeanings.length > 0;
  if (!chineseMeanings.length) {
    chineseMeanings = findFallbackMeanings(raw);
    hasDictionaryChinese = false;
  }

  const entry = {
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
      chinese_meaning: hasDictionaryChinese
        ? "NihongDict"
        : chineseMeanings.length
          ? "translation-overrides.zh-TW"
          : "missing",
    },
    review: {
      zh_meaning_checked: false,
      kana_checked: true,
    },
  };
  const correction = entryCorrections[`${level}:${index + 1}`];
  if (!correction) return entry;

  const correctedEntry = { ...entry, ...correction };
  if (correction.meanings_zh) {
    correctedEntry.source = {
      ...correctedEntry.source,
      chinese_meaning: "translation-overrides.zh-TW",
    };
  }
  return correctedEntry;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const chineseIndex = parseStarDictIndex(
  path.join(nihongDictDir, "Japanese_Chinese.idx"),
  path.join(nihongDictDir, "Japanese_Chinese.dict"),
);

cleanDir(outDir);
writeJson(translationOverridesPath, translationOverrides);

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

    const folder = safeFolderName(index, entry.display, entry.kana);
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
